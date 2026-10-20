import type { Metar } from '@skywake/shared';
import type { UpstreamRequest } from '../gate-core.js';

/** NOAA Aviation Weather Center data API: US government work, public domain; 100 req/min published limit. */
export const AWC_ID = 'aviationweather';

export const ICAO_RE = /^[A-Z][A-Z0-9]{3}$/;

const METAR_TTL_MS = 10 * 60_000;

const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

export function parseMetar(raw: string): Metar | null {
  if (!raw.trim()) return null;
  const list = JSON.parse(raw) as unknown;
  if (!Array.isArray(list)) throw new Error('metar: not an array');
  const m = list[0] as Record<string, unknown> | undefined;
  if (!m || typeof m.icaoId !== 'string' || typeof m.rawOb !== 'string') return null;
  const obs = num(m.obsTime);
  if (obs === undefined) return null;
  let visibilitySm: number | undefined;
  let visibilityPlus: boolean | undefined;
  if (typeof m.visib === 'number') visibilitySm = m.visib;
  else if (typeof m.visib === 'string') {
    const v = Number.parseFloat(m.visib);
    if (Number.isFinite(v)) {
      visibilitySm = v;
      visibilityPlus = m.visib.endsWith('+') || undefined;
    }
  }
  const clouds = (Array.isArray(m.clouds) ? m.clouds : [])
    .filter((c): c is Record<string, unknown> => !!c && typeof (c as Record<string, unknown>).cover === 'string')
    .slice(0, 6)
    .map((c) => ({ cover: c.cover as string, baseFt: num(c.base) }));
  return {
    icao: m.icaoId,
    obsTime: obs * 1000,
    raw: m.rawOb.slice(0, 300),
    tempC: num(m.temp),
    dewpointC: num(m.dewp),
    windDir: num(m.wdir),
    windKt: num(m.wspd),
    gustKt: num(m.wgst),
    visibilitySm,
    visibilityPlus,
    qnhHpa: num(m.altim),
    category: typeof m.fltCat === 'string' && /^(VFR|MVFR|IFR|LIFR)$/.test(m.fltCat) ? m.fltCat : undefined,
    clouds,
  };
}

export function metarRequest(icao: string): UpstreamRequest {
  return {
    key: `metar:${icao}`,
    url: `https://aviationweather.gov/api/data/metar?ids=${icao}&format=json`,
    ttlMs: METAR_TTL_MS,
    notFoundIsEmpty: true,
    transform: (raw) => JSON.stringify(parseMetar(raw)),
  };
}
