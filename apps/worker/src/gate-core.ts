/**
 * Upstream gate: the single place that talks to volunteer-run data providers.
 *
 * - Coalesces identical in-flight requests (one upstream call no matter how many users ask).
 * - Caches results with a freshness TTL and serves stale data, flagged, while upstream
 *   is throttled or down.
 * - Enforces a token bucket plus per-minute and per-day caps that stay below provider limits.
 * - Backs off on 429 / 5xx, honouring Retry-After.
 *
 * Kept free of Cloudflare APIs so it can be unit tested in Node.
 */

export interface GateLimits {
  /** Sustained upstream requests per second. */
  rps: number;
  burst: number;
  perMinute: number;
  /** 0 = no daily cap. */
  perDay: number;
}

export interface CachedEntry {
  body: string;
  /** When the upstream response was received (ms). */
  fetchedAt: number;
}

export type GateResult =
  | { ok: true; body: string; fetchedAt: number; stale: boolean }
  | { ok: false; status: number; error: string; retryAfter?: number };

export interface UpstreamRequest {
  key: string;
  url: string;
  init?: RequestInit;
  /** How long a cached result counts as fresh. */
  ttlMs: number;
  /** Turn a raw upstream body into what we cache/serve. Throwing marks the upstream as faulty. */
  transform: (raw: string, receivedAt: number) => string;
  /** Treat HTTP 404 as a valid empty answer (cached like a success). */
  notFoundIsEmpty?: boolean;
}

export interface GateStats {
  lastSuccess: number | null;
  lastError: string | null;
  lastErrorAt: number | null;
  requestsLastMinute: number;
  requestsToday: number;
  backoffUntil: number | null;
  cacheEntries: number;
}

const MAX_STALE_MS = 10 * 60_000;
const MAX_ENTRIES = 3000;
const UPSTREAM_TIMEOUT_MS = 8000;

export class GateCore {
  private cache = new Map<string, CachedEntry>();
  private inflight = new Map<string, Promise<GateResult>>();
  private tokens: number;
  private lastRefill: number;
  private minuteLog: number[] = [];
  private dayStart: number;
  private dayCount = 0;
  private backoffUntil = 0;
  private consecutiveFailures = 0;
  private lastSuccess: number | null = null;
  private lastError: string | null = null;
  private lastErrorAt: number | null = null;

  constructor(
    private limits: GateLimits,
    private fetchFn: typeof fetch,
    private now: () => number = Date.now,
    private userAgent = 'Skywake/0.1 (+https://github.com/andrei1000z/skywake)',
  ) {
    this.tokens = limits.burst;
    this.lastRefill = now();
    this.dayStart = now();
  }

  stats(): GateStats {
    const t = this.now();
    this.pruneMinute(t);
    return {
      lastSuccess: this.lastSuccess,
      lastError: this.lastError,
      lastErrorAt: this.lastErrorAt,
      requestsLastMinute: this.minuteLog.length,
      requestsToday: this.dayCount,
      backoffUntil: this.backoffUntil > t ? this.backoffUntil : null,
      cacheEntries: this.cache.size,
    };
  }

  async get(req: UpstreamRequest): Promise<GateResult> {
    const t = this.now();
    const cached = this.cache.get(req.key);
    if (cached && t - cached.fetchedAt < req.ttlMs) {
      return { ok: true, body: cached.body, fetchedAt: cached.fetchedAt, stale: false };
    }
    const pending = this.inflight.get(req.key);
    if (pending) return pending;

    const p = this.fetchUpstream(req, cached).finally(() => this.inflight.delete(req.key));
    this.inflight.set(req.key, p);
    return p;
  }

  private serveStaleOr(cached: CachedEntry | undefined, status: number, error: string, retryAfter?: number): GateResult {
    if (cached && this.now() - cached.fetchedAt < MAX_STALE_MS) {
      return { ok: true, body: cached.body, fetchedAt: cached.fetchedAt, stale: true };
    }
    return retryAfter === undefined ? { ok: false, status, error } : { ok: false, status, error, retryAfter };
  }

  private takeToken(t: number): boolean {
    const elapsed = (t - this.lastRefill) / 1000;
    this.tokens = Math.min(this.limits.burst, this.tokens + elapsed * this.limits.rps);
    this.lastRefill = t;
    this.pruneMinute(t);
    if (t - this.dayStart >= 86_400_000) {
      this.dayStart = t;
      this.dayCount = 0;
    }
    if (this.tokens < 1) return false;
    if (this.minuteLog.length >= this.limits.perMinute) return false;
    if (this.limits.perDay > 0 && this.dayCount >= this.limits.perDay) return false;
    this.tokens -= 1;
    this.minuteLog.push(t);
    this.dayCount += 1;
    return true;
  }

  private pruneMinute(t: number) {
    while (this.minuteLog.length && t - this.minuteLog[0]! >= 60_000) this.minuteLog.shift();
  }

  private recordFailure(msg: string, retryAfterS?: number) {
    const t = this.now();
    this.lastError = msg;
    this.lastErrorAt = t;
    this.consecutiveFailures += 1;
    const expo = Math.min(120_000, 1000 * 2 ** Math.min(7, this.consecutiveFailures));
    this.backoffUntil = t + Math.max(expo, (retryAfterS ?? 0) * 1000);
  }

  private async fetchUpstream(req: UpstreamRequest, cached: CachedEntry | undefined): Promise<GateResult> {
    const t = this.now();
    if (this.backoffUntil > t) {
      return this.serveStaleOr(cached, 503, 'upstream_backoff', Math.ceil((this.backoffUntil - t) / 1000));
    }
    if (!this.takeToken(t)) {
      return this.serveStaleOr(cached, 503, 'rate_budget_exhausted', 2);
    }

    let res: Response;
    try {
      const headers = new Headers(req.init?.headers);
      headers.set('user-agent', this.userAgent);
      headers.set('accept', 'application/json');
      res = await this.fetchFn(req.url, { ...req.init, headers, signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS) });
    } catch (e) {
      this.recordFailure(`network: ${e instanceof Error ? e.name : 'error'}`);
      return this.serveStaleOr(cached, 502, 'upstream_unreachable', 5);
    }

    if (res.status === 429 || res.status >= 500) {
      const ra = Number(res.headers.get('retry-after') ?? res.headers.get('x-ratelimit-reset'));
      const retryAfter = Number.isFinite(ra) && ra > 0 ? Math.min(ra, 3600) : undefined;
      this.recordFailure(`http ${res.status}`, retryAfter);
      await res.body?.cancel();
      return this.serveStaleOr(cached, 503, res.status === 429 ? 'upstream_rate_limited' : 'upstream_error', retryAfter ?? 5);
    }
    if (!res.ok && !(res.status === 404 && req.notFoundIsEmpty)) {
      // 4xx other than 429 means our request is wrong; don't back off the whole provider.
      this.lastError = `http ${res.status}`;
      this.lastErrorAt = this.now();
      await res.body?.cancel();
      return this.serveStaleOr(cached, 502, `upstream_http_${res.status}`);
    }

    let body: string;
    try {
      const raw = res.status === 404 ? (await res.body?.cancel(), '') : await res.text();
      body = req.transform(raw, this.now());
    } catch (e) {
      this.recordFailure(`bad payload: ${e instanceof Error ? e.message.slice(0, 80) : 'unknown'}`);
      return this.serveStaleOr(cached, 502, 'upstream_bad_payload', 5);
    }

    const fetchedAt = this.now();
    this.consecutiveFailures = 0;
    this.lastSuccess = fetchedAt;
    this.cache.delete(req.key);
    this.cache.set(req.key, { body, fetchedAt });
    if (this.cache.size > MAX_ENTRIES) {
      const oldest = this.cache.keys().next().value;
      if (oldest !== undefined) this.cache.delete(oldest);
    }
    return { ok: true, body, fetchedAt, stale: false };
  }
}
