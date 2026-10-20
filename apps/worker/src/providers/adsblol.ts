import { cellCenter, cellRadiusNm, type Cell, normalizeReadsbResponse } from '@skywake/shared';
import type { UpstreamRequest } from '../gate-core.js';

/**
 * ADSB.lol — community ADS-B/MLAT aggregator. Data is ODbL 1.0.
 * Docs: https://api.adsb.lol/docs  ·  https://github.com/adsblol/api
 */
export const ADSBLOL_ID = 'adsblol';
const BASE = 'https://api.adsb.lol';

export const TTL = {
  cell: 10_000,
  hex: 5_000,
  search: 20_000,
  emergency: 30_000,
  route: 6 * 3600_000,
} as const;

/** Body cached by the gate: `{"ts":…,"aircraft":[…]}` */
function aircraftTransform(raw: string, receivedAt: number): string {
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || !('ac' in parsed)) throw new Error('missing ac');
  const { ts, aircraft } = normalizeReadsbResponse(parsed, ADSBLOL_ID, receivedAt);
  return JSON.stringify({ ts, aircraft });
}

export function cellRequest(cell: Cell): UpstreamRequest {
  const c = cellCenter(cell);
  return {
    key: `cell:${cell.id}`,
    url: `${BASE}/v2/point/${c.lat.toFixed(4)}/${c.lon.toFixed(4)}/${cellRadiusNm(cell)}`,
    ttlMs: TTL.cell,
    transform: aircraftTransform,
  };
}

export function hexRequest(hex: string): UpstreamRequest {
  return { key: `hex:${hex}`, url: `${BASE}/v2/hex/${hex}`, ttlMs: TTL.hex, transform: aircraftTransform };
}

export function callsignRequest(cs: string): UpstreamRequest {
  return { key: `cs:${cs}`, url: `${BASE}/v2/callsign/${encodeURIComponent(cs)}`, ttlMs: TTL.search, transform: aircraftTransform };
}

export function regRequest(reg: string): UpstreamRequest {
  return { key: `reg:${reg}`, url: `${BASE}/v2/reg/${encodeURIComponent(reg)}`, ttlMs: TTL.search, transform: aircraftTransform };
}

export function squawkRequest(sq: string): UpstreamRequest {
  return { key: `sqk:${sq}`, url: `${BASE}/v2/sqk/${sq}`, ttlMs: TTL.emergency, transform: aircraftTransform };
}

/**
 * Callsign → route from VRS standing data (CC0, community maintained), hosted by ADSB.lol.
 * https://github.com/vradarserver/standing-data. Routes are what the callsign usually flies;
 * the client checks plausibility against the live position before showing one.
 */
export function routeRequest(callsign: string): UpstreamRequest {
  return {
    key: `route:${callsign}`,
    url: `https://vrs-standing-data.adsb.lol/routes/${callsign.slice(0, 2)}/${callsign}.json`,
    ttlMs: TTL.route,
    notFoundIsEmpty: true,
    transform(raw) {
      if (!raw.trim()) return 'null';
      const r = JSON.parse(raw) as Record<string, unknown>;
      if (typeof r.callsign !== 'string' || !Array.isArray(r._airports)) return 'null';
      const str = (v: unknown) => (typeof v === 'string' ? v : undefined);
      const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
      const airports = (r._airports as Record<string, unknown>[])
        .filter((a) => typeof a.icao === 'string')
        .map((a) => ({
          icao: a.icao as string,
          iata: str(a.iata),
          name: str(a.name),
          city: str(a.location),
          country: str(a.countryiso2),
          lat: num(a.lat),
          lon: num(a.lon),
        }));
      if (airports.length < 2) return 'null';
      return JSON.stringify({ callsign: r.callsign, airports, plausible: false, provider: 'vrs-standing-data' });
    },
  };
}
