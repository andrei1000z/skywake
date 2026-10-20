import { type Aircraft, parseCell } from '@skywake/shared';
import type { GateCore, GateResult } from './gate-core.js';
import { ICAO_RE, metarRequest } from './providers/aviationweather.js';
import { ADSBLOL_ID, callsignRequest, cellRequest, hexRequest, regRequest, routeRequest, squawkRequest } from './providers/adsblol.js';

export const HEX_RE = /^~?[0-9a-f]{6}$/;
export const CALLSIGN_RE = /^[A-Z0-9]{2,8}$/;
export const REG_RE = /^[A-Z0-9-]{2,10}$/;

const json = (body: string, status = 200, extra: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'application/json; charset=utf-8', ...extra } });

function errorResponse(r: Extract<GateResult, { ok: false }>): Response {
  const headers: Record<string, string> = {};
  if (r.retryAfter !== undefined) headers['retry-after'] = String(r.retryAfter);
  return json(JSON.stringify({ error: r.error, retryAfter: r.retryAfter }), r.status, headers);
}

/** `{"ts":…,"aircraft":[…]}` → public AircraftListResponse, without re-parsing. */
function aircraftBody(r: Extract<GateResult, { ok: true }>, prefix = ''): string {
  return `{${prefix}"provider":"${ADSBLOL_ID}","stale":${r.stale},${r.body.slice(1)}`;
}

function mergeAircraft(results: GateResult[]): Response {
  const ok = results.filter((r): r is Extract<GateResult, { ok: true }> => r.ok);
  if (ok.length === 0) return errorResponse(results[0] as Extract<GateResult, { ok: false }>);
  const byHex = new Map<string, Aircraft>();
  let ts = 0;
  for (const r of ok) {
    const parsed = JSON.parse(r.body) as { ts: number; aircraft: Aircraft[] };
    ts = Math.max(ts, parsed.ts);
    for (const a of parsed.aircraft) byHex.set(a.hex, a);
  }
  const stale = ok.some((r) => r.stale) || ok.length < results.length;
  return json(JSON.stringify({ provider: ADSBLOL_ID, stale, ts, aircraft: [...byHex.values()] }));
}

/**
 * Executes one gate operation. `op` is the op name, e.g. "cell".
 * `weather` is a separate budget for the weather provider so it never eats the ADS-B budget.
 */
export async function gateOp(core: GateCore, op: string, params: URLSearchParams, weather: GateCore = core): Promise<Response> {
  switch (op) {
    case 'cell': {
      const cell = parseCell(params.get('id') ?? '');
      if (!cell) return json('{"error":"bad_cell"}', 400);
      const r = await core.get(cellRequest(cell));
      return r.ok ? json(aircraftBody(r, `"cell":"${cell.id}",`)) : errorResponse(r);
    }
    case 'hex': {
      const hex = (params.get('hex') ?? '').toLowerCase();
      if (!HEX_RE.test(hex)) return json('{"error":"bad_hex"}', 400);
      const r = await core.get(hexRequest(hex));
      return r.ok ? json(aircraftBody(r)) : errorResponse(r);
    }
    case 'search': {
      const q = (params.get('q') ?? '').trim().toUpperCase();
      if (HEX_RE.test(q.toLowerCase())) {
        const byHex = await core.get(hexRequest(q.toLowerCase()));
        // A 6-char hex-looking string can also be a callsign (e.g. "ABC123").
        const cs = CALLSIGN_RE.test(q) ? await core.get(callsignRequest(q)) : null;
        return mergeAircraft(cs ? [byHex, cs] : [byHex]);
      }
      const reqs: Promise<GateResult>[] = [];
      if (CALLSIGN_RE.test(q)) reqs.push(core.get(callsignRequest(q)));
      if (REG_RE.test(q)) reqs.push(core.get(regRequest(q)));
      if (reqs.length === 0) return json('{"error":"bad_query"}', 400);
      return mergeAircraft(await Promise.all(reqs));
    }
    case 'emergencies': {
      return mergeAircraft(await Promise.all(['7700', '7600', '7500'].map((s) => core.get(squawkRequest(s)))));
    }
    case 'route': {
      const cs = (params.get('callsign') ?? '').toUpperCase();
      if (!CALLSIGN_RE.test(cs)) return json('{"error":"bad_callsign"}', 400);
      const r = await core.get(routeRequest(cs));
      return r.ok ? json(`{"stale":${r.stale},"route":${r.body}}`) : errorResponse(r);
    }
    case 'metar': {
      const icao = (params.get('icao') ?? '').toUpperCase();
      if (!ICAO_RE.test(icao)) return json('{"error":"bad_icao"}', 400);
      const r = await weather.get(metarRequest(icao));
      return r.ok ? json(`{"stale":${r.stale},"metar":${r.body}}`) : errorResponse(r);
    }
    case 'stats':
      return json(JSON.stringify(core.stats()));
    case 'weather-stats':
      return json(JSON.stringify(weather.stats()));
    default:
      return json('{"error":"not_found"}', 404);
  }
}
