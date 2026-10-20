import {
  type Aircraft,
  type BBox,
  cellForPoint,
  cellsForBBox,
  type CellResponse,
  mercatorVelocity,
  toMercator,
} from '@skywake/shared';
import { api, ApiError } from './api';

/** Max seconds we keep extrapolating a position without a new report. */
export const MAX_EXTRAPOLATION_S = 20;
/** Correction offsets blend out over this many seconds, so updates never teleport an icon. */
export const CORRECTION_S = 1.2;
const CELL_REFRESH_MS = 8_000;
/** The gate allows 40 upstream calls a minute (1.5 s each), so wide views refresh each cell less often. */
const PER_CELL_REFRESH_MS = 1_600;
const CELL_CONCURRENCY = 4;
const DROP_UNSEEN_MS = 45_000;
const OUT_OF_VIEW_GRACE_MS = 30_000;
const TRAIL_MAX = 400;

export interface Tracked {
  ac: Aircraft;
  /** Mercator position at `baseT` (seconds, performance clock). */
  mx: number;
  my: number;
  vx: number;
  vy: number;
  baseT: number;
  corrX: number;
  corrY: number;
  corrT: number;
  /** performance.now() ms when last refreshed by any response. */
  lastSeen: number;
  /** [lon, lat, altFt|null, epochMs] since the user started watching. */
  trail: [number, number, number | null, number][];
}

export type FeedState = 'loading' | 'live' | 'stale' | 'error' | 'offline';

export interface FeedStatus {
  state: FeedState;
  /** Oldest snapshot time among loaded cells (epoch ms) — what the user is actually looking at. */
  oldestSnapshot: number | null;
  truncated: boolean;
  cellsLoaded: number;
  cellsWanted: number;
  lastError: string | null;
}

interface CellState {
  fetchedAt: number;
  snapshot: number;
  stale: boolean;
  inflight: boolean;
  failures: number;
  retryAt: number;
}

const perfNowS = () => performance.now() / 1000;

/** Converts an epoch-ms timestamp to seconds on the performance clock. */
function epochToPerfS(ms: number): number {
  return perfNowS() + (ms - Date.now()) / 1000;
}

export function positionAt(t: Tracked, nowS: number): { x: number; y: number } {
  const dt = Math.max(0, Math.min(nowS - t.baseT, MAX_EXTRAPOLATION_S));
  const k = Math.max(0, 1 - (nowS - t.corrT) / CORRECTION_S);
  return { x: t.mx + t.vx * dt + t.corrX * k, y: t.my + t.vy * dt + t.corrY * k };
}

export function velocityFor(ac: Aircraft): { vx: number; vy: number } {
  if (ac.onGround || ac.gs === undefined || ac.track === undefined || ac.gs < 1) return { vx: 0, vy: 0 };
  return mercatorVelocity(ac.lat, ac.gs, ac.track);
}

export class LiveStore {
  readonly aircraft = new Map<string, Tracked>();
  /** Bumped whenever aircraft are added, removed or updated. */
  version = 0;
  status: FeedStatus = { state: 'loading', oldestSnapshot: null, truncated: false, cellsLoaded: 0, cellsWanted: 0, lastError: null };
  selected: string | null = null;

  private cells = new Map<string, CellState>();
  private wanted: string[] = [];
  private listeners = new Set<() => void>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private selectedTimer: ReturnType<typeof setInterval> | null = null;
  private abort = new AbortController();
  private online = typeof navigator === 'undefined' ? true : navigator.onLine;

  constructor(private fetchCell: (id: string, s: AbortSignal) => Promise<CellResponse> = api.cell) {}

  start() {
    if (this.timer) return;
    this.timer = setInterval(() => this.pump(), 1000);
    this.selectedTimer = setInterval(() => void this.refreshSelected(), 5000);
    window.addEventListener('online', this.onOnline);
    window.addEventListener('offline', this.onOffline);
    document.addEventListener('visibilitychange', this.onVisibility);
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    if (this.selectedTimer) clearInterval(this.selectedTimer);
    this.timer = this.selectedTimer = null;
    this.abort.abort();
    this.abort = new AbortController();
    window.removeEventListener('online', this.onOnline);
    window.removeEventListener('offline', this.onOffline);
    document.removeEventListener('visibilitychange', this.onVisibility);
  }

  private onOnline = () => {
    this.online = true;
    this.cells.forEach((c) => (c.retryAt = 0));
    this.pump();
  };
  private onOffline = () => {
    this.online = false;
    this.setStatus({ state: 'offline' });
  };
  // Hidden tabs stop polling entirely: no point spending volunteer bandwidth on nobody.
  private onVisibility = () => {
    if (document.visibilityState === 'visible') this.pump();
  };

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }

  private emit() {
    this.version++;
    this.listeners.forEach((f) => f());
  }

  private setStatus(p: Partial<FeedStatus>) {
    this.status = { ...this.status, ...p };
    this.listeners.forEach((f) => f());
  }

  setViewport(bbox: BBox) {
    const { cells, truncated } = cellsForBBox(bbox);
    this.wanted = cells.map((c) => c.id);
    this.setStatus({ truncated, cellsWanted: this.wanted.length });
    this.pump();
  }

  select(hex: string | null) {
    this.selected = hex;
    this.emit();
    if (hex && !this.aircraft.has(hex)) void this.refreshSelected();
  }

  /** Merge aircraft (from a cell, search or single lookup) into the store. */
  ingest(list: Aircraft[]) {
    const nowS = perfNowS();
    const nowMs = performance.now();
    for (const ac of list) {
      const existing = this.aircraft.get(ac.hex);
      // Never go backwards in time: a cached cell can be older than a direct lookup.
      if (existing && existing.ac.posTs > ac.posTs) {
        existing.lastSeen = nowMs;
        continue;
      }
      const m = toMercator(ac.lat, ac.lon);
      const v = velocityFor(ac);
      const baseT = Math.min(nowS, epochToPerfS(ac.posTs));
      if (existing) {
        const shown = positionAt(existing, nowS);
        const fresh = { x: m.x + v.vx * (nowS - baseT), y: m.y + v.vy * (nowS - baseT) };
        let cx = shown.x - fresh.x;
        const cy = shown.y - fresh.y;
        // Antimeridian: don't animate the long way round.
        if (Math.abs(cx) > 0.5) cx = 0;
        const big = Math.hypot(cx, cy) > 0.0005; // ~20 km: a genuine jump, not drift
        existing.corrX = big ? 0 : cx;
        existing.corrY = big ? 0 : cy;
        existing.corrT = nowS;
        if (existing.ac.posTs !== ac.posTs) {
          const last = existing.trail[existing.trail.length - 1];
          if (!last || last[0] !== ac.lon || last[1] !== ac.lat) {
            existing.trail.push([ac.lon, ac.lat, ac.onGround ? 0 : (ac.alt ?? null), ac.posTs]);
            if (existing.trail.length > TRAIL_MAX) existing.trail.shift();
          }
        }
        Object.assign(existing, { ac, mx: m.x, my: m.y, vx: v.vx, vy: v.vy, baseT, lastSeen: nowMs });
      } else {
        this.aircraft.set(ac.hex, {
          ac, mx: m.x, my: m.y, vx: v.vx, vy: v.vy, baseT,
          corrX: 0, corrY: 0, corrT: 0, lastSeen: nowMs,
          trail: [[ac.lon, ac.lat, ac.onGround ? 0 : (ac.alt ?? null), ac.posTs]],
        });
      }
    }
    this.emit();
  }

  private prune() {
    const now = performance.now();
    const wanted = new Set(this.wanted);
    let changed = false;
    for (const [hex, t] of this.aircraft) {
      if (hex === this.selected) {
        if (now - t.lastSeen > DROP_UNSEEN_MS * 4) {
          this.aircraft.delete(hex);
          changed = true;
        }
        continue;
      }
      const inView = wanted.has(cellForPoint(t.ac.lat, t.ac.lon).id);
      if (now - t.lastSeen > (inView ? DROP_UNSEEN_MS : OUT_OF_VIEW_GRACE_MS)) {
        this.aircraft.delete(hex);
        changed = true;
      }
    }
    if (changed) this.emit();
  }

  private refreshMs() {
    return Math.max(CELL_REFRESH_MS, this.wanted.length * PER_CELL_REFRESH_MS);
  }

  private pump() {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return;
    this.prune();
    if (!this.online) return;
    const now = Date.now();
    let inflight = [...this.cells.values()].filter((c) => c.inflight).length;
    const refresh = this.refreshMs();
    // A stale answer means the gate was pacing upstream; such cells wait only for their retryAt.
    const due = this.wanted.filter((id) => {
      const c = this.cells.get(id);
      return !c || (!c.inflight && (c.stale || now - c.fetchedAt >= refresh) && now >= c.retryAt);
    });
    // Oldest data first (stable sort keeps the centre-first order among unloaded cells), so no cell starves.
    due.sort((a, b) => (this.cells.get(a)?.snapshot ?? 0) - (this.cells.get(b)?.snapshot ?? 0));
    for (const id of due) {
      if (inflight >= CELL_CONCURRENCY) break;
      inflight++;
      void this.loadCell(id);
    }
    this.updateStatus();
  }

  private async loadCell(id: string) {
    const prev = this.cells.get(id);
    const c: CellState = prev ?? { fetchedAt: 0, snapshot: 0, stale: false, inflight: false, failures: 0, retryAt: 0 };
    c.inflight = true;
    this.cells.set(id, c);
    try {
      const res = await this.fetchCell(id, this.abort.signal);
      c.fetchedAt = Date.now();
      c.snapshot = res.ts;
      c.stale = res.stale;
      c.failures = 0;
      // Past the 2 s max-age the gate puts on stale answers, so the retry is not a browser-cache hit.
      if (res.stale) c.retryAt = c.fetchedAt + 2500 + Math.random() * 1500;
      // Aircraft that left this cell's circle reappear via a neighbour; ones simply gone get pruned by age.
      this.ingest(res.aircraft);
      this.status.lastError = null;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
      const ra = e instanceof ApiError && e.retryAfter ? e.retryAfter * 1000 : 0;
      if (e instanceof ApiError && e.code === 'rate_budget_exhausted') {
        // Our own gate pacing a cold view (upstream is fine): queue a jittered retry, not a failure.
        // Data that stays unrefreshed still turns the banner on through the age check below.
        c.retryAt = Date.now() + Math.max(ra, 1000) + Math.random() * 1500;
        return;
      }
      c.failures++;
      c.retryAt = Date.now() + Math.max(ra, Math.min(60_000, 2000 * 2 ** c.failures));
      this.status.lastError = e instanceof ApiError ? e.code : 'network';
    } finally {
      c.inflight = false;
      this.updateStatus();
    }
  }

  private updateStatus() {
    if (!this.online) return this.setStatus({ state: 'offline' });
    let loaded = 0;
    let stale = false;
    let oldest: number | null = null;
    const refresh = this.refreshMs();
    for (const id of this.wanted) {
      const c = this.cells.get(id);
      if (!c || c.fetchedAt === 0) continue;
      loaded++;
      // The gate also marks cache hits served while it paces upstream as stale; those are seconds old.
      if ((c.stale && Date.now() - c.snapshot > refresh * 3) || Date.now() - c.fetchedAt > refresh * 4) stale = true;
      oldest = oldest === null ? c.snapshot : Math.min(oldest, c.snapshot);
    }
    const anyFailing = this.wanted.some((id) => (this.cells.get(id)?.failures ?? 0) > 0);
    let state: FeedState;
    if (loaded === 0) state = anyFailing ? 'error' : 'loading';
    else state = stale || anyFailing ? 'stale' : 'live';
    if (this.wanted.length === 0) state = 'live';
    this.setStatus({ state, oldestSnapshot: oldest, cellsLoaded: loaded });
  }

  private async refreshSelected() {
    const hex = this.selected;
    if (!hex || !this.online || document.visibilityState === 'hidden') return;
    const t = this.aircraft.get(hex);
    // Covered by a fresh cell: nothing to do.
    if (t && performance.now() - t.lastSeen < 6000) return;
    try {
      const res = await api.aircraft(hex, this.abort.signal);
      if (res.aircraft.length) this.ingest(res.aircraft);
    } catch {
      /* status bar already reflects API trouble */
    }
  }
}

export const liveStore = new LiveStore();
