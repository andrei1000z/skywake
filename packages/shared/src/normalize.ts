import type { Aircraft, PositionSource } from './types.js';

/** Positions older than this are dropped: they are no longer useful for a live map. */
export const MAX_POSITION_AGE_S = 60;

const HEX_RE = /^~?[0-9a-f]{6}$/;

function num(v: unknown): number | undefined {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function str(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined;
  const s = v.trim();
  return s.length > 0 ? s : undefined;
}

export function validLatLon(lat: unknown, lon: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lon === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lon) &&
    lat >= -90 &&
    lat <= 90 &&
    lon >= -180 &&
    lon <= 180 &&
    // (0,0) "Null Island" is a classic decoder default, never a real aircraft report.
    !(lat === 0 && lon === 0)
  );
}

function mapSource(type: unknown): PositionSource {
  switch (type) {
    case 'adsb_icao':
    case 'adsb_icao_nt':
    case 'adsb_other':
      return 'adsb';
    case 'mlat':
      return 'mlat';
    case 'tisb_icao':
    case 'tisb_trackfile':
    case 'tisb_other':
      return 'tisb';
    case 'adsr_icao':
    case 'adsr_other':
      return 'adsr';
    case 'mode_s':
      return 'modes';
    default:
      return 'other';
  }
}

/**
 * Normalize one readsb/ADSBExchange-v2-compatible record (as served by ADSB.lol).
 * Returns null for records without a usable, recent position.
 * @param snapshotMs upstream `now` of the response, epoch ms
 */
export function normalizeReadsb(raw: unknown, snapshotMs: number, provider: string): Aircraft | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const hex = typeof r.hex === 'string' ? r.hex.toLowerCase() : '';
  if (!HEX_RE.test(hex)) return null;
  if (!validLatLon(r.lat, r.lon)) return null;
  const seenPos = num(r.seen_pos) ?? num(r.seen) ?? 0;
  if (seenPos < 0 || seenPos > MAX_POSITION_AGE_S) return null;

  const onGround = r.alt_baro === 'ground';
  const ac: Aircraft = {
    hex,
    lat: r.lat as number,
    lon: r.lon as number,
    onGround,
    src: mapSource(r.type),
    posTs: Math.round(snapshotMs - seenPos * 1000),
    provider,
  };
  const callsign = str(r.flight);
  if (callsign) ac.callsign = callsign.toUpperCase();
  const reg = str(r.r);
  if (reg) ac.reg = reg.toUpperCase();
  const type = str(r.t);
  if (type) ac.type = type.toUpperCase();
  const cat = str(r.category);
  if (cat) ac.cat = cat;
  const alt = num(r.alt_baro);
  if (alt !== undefined && alt > -2000 && alt < 100000) ac.alt = Math.round(alt);
  const altGeom = num(r.alt_geom);
  if (altGeom !== undefined && altGeom > -2000 && altGeom < 100000) ac.altGeom = Math.round(altGeom);
  const gs = num(r.gs);
  if (gs !== undefined && gs >= 0 && gs < 2000) ac.gs = Math.round(gs * 10) / 10;
  const track = num(r.track) ?? num(r.true_heading) ?? num(r.calc_track);
  if (track !== undefined) ac.track = ((track % 360) + 360) % 360;
  const vr = num(r.baro_rate) ?? num(r.geom_rate);
  if (vr !== undefined && Math.abs(vr) < 20000) ac.vr = Math.round(vr);
  const squawk = str(r.squawk);
  if (squawk && /^[0-7]{4}$/.test(squawk)) ac.squawk = squawk;
  const emergency = str(r.emergency);
  if (emergency && emergency !== 'none') ac.emergency = emergency;
  const dbFlags = num(r.dbFlags);
  if (dbFlags !== undefined && (dbFlags & 1) === 1) ac.mil = true;
  return ac;
}

/** Normalize a full readsb-style response `{ now, ac: [...] }`. Never throws on bad input. */
export function normalizeReadsbResponse(body: unknown, provider: string, fallbackNow: number): { ts: number; aircraft: Aircraft[] } {
  if (!body || typeof body !== 'object') return { ts: fallbackNow, aircraft: [] };
  const b = body as Record<string, unknown>;
  const now = num(b.now);
  // Guard against a wildly wrong upstream clock: trust ours if they disagree by > 5 min.
  const ts = now !== undefined && Math.abs(now - fallbackNow) < 300_000 ? now : fallbackNow;
  const list = Array.isArray(b.ac) ? b.ac : [];
  const out: Aircraft[] = [];
  const seen = new Set<string>();
  for (const raw of list) {
    const ac = normalizeReadsb(raw, ts, provider);
    if (ac && !seen.has(ac.hex)) {
      seen.add(ac.hex);
      out.push(ac);
    }
  }
  return { ts, aircraft: out };
}
