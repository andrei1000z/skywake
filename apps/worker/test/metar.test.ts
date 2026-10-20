import { describe, expect, it, vi } from 'vitest';
import { GateCore } from '../src/gate-core.js';
import { gateOp } from '../src/gate-ops.js';
import { parseMetar } from '../src/providers/aviationweather.js';

// Real aviationweather.gov response for LROP, captured 2026-10-20 (US government work, public domain).
const LROP = JSON.stringify([{
  icaoId: 'LROP', receiptTime: '2026-10-20T16:04:21.488Z', obsTime: 1792512000, reportTime: '2026-10-20T16:00:00.000Z',
  temp: 15, dewp: 12, wdir: 110, wspd: 3, visib: '6+', altim: 1023, qcField: 16, metarType: 'METAR',
  rawOb: 'METAR LROP 201600Z 11003KT CAVOK 15/12 Q1023 NOSIG', lat: 44.572, lon: 26.102, elev: 92,
  name: 'Bucharest/Coandă Intl, B, RO', cover: 'CAVOK', clouds: [], fltCat: 'VFR',
}]);

describe('parseMetar', () => {
  it('normalises a real observation', () => {
    expect(parseMetar(LROP)).toEqual({
      icao: 'LROP', obsTime: 1792512000_000, raw: 'METAR LROP 201600Z 11003KT CAVOK 15/12 Q1023 NOSIG',
      tempC: 15, dewpointC: 12, windDir: 110, windKt: 3, gustKt: undefined, visibilitySm: 6, visibilityPlus: true,
      qnhHpa: 1023, category: 'VFR', clouds: [],
    });
  });

  it('treats an empty body (HTTP 204, unknown station) as no data', () => {
    expect(parseMetar('')).toBeNull();
    expect(parseMetar('[]')).toBeNull();
  });

  it('drops variable wind and unknown flight categories instead of guessing', () => {
    const m = parseMetar(JSON.stringify([{ icaoId: 'EGLL', obsTime: 1, rawOb: 'x', wdir: 'VRB', fltCat: 'BAD', clouds: [{ cover: 'BKN', base: 1200 }] }]));
    expect(m).toMatchObject({ windDir: undefined, category: undefined, clouds: [{ cover: 'BKN', baseFt: 1200 }] });
  });

  it('rejects non-array payloads', () => {
    expect(() => parseMetar('{"error":1}')).toThrow('metar: not an array');
  });
});

describe('metar op', () => {
  const setup = () => {
    const adsbFetch = vi.fn(async () => new Response('{}'));
    const wxFetch = vi.fn(async () => new Response(LROP));
    const lim = { rps: 1, burst: 3, perMinute: 50, perDay: 0 };
    return { adsbFetch, wxFetch, core: new GateCore(lim, adsbFetch as unknown as typeof fetch), weather: new GateCore(lim, wxFetch as unknown as typeof fetch) };
  };

  it('uses the weather budget, not the ADS-B one, and caches', async () => {
    const { adsbFetch, wxFetch, core, weather } = setup();
    const a = await gateOp(core, 'metar', new URLSearchParams('icao=lrop'), weather);
    await gateOp(core, 'metar', new URLSearchParams('icao=LROP'), weather);
    expect(adsbFetch).not.toHaveBeenCalled();
    expect(wxFetch).toHaveBeenCalledTimes(1);
    expect(String(wxFetch.mock.calls[0]![0 as never])).toBe('https://aviationweather.gov/api/data/metar?ids=LROP&format=json');
    expect(await a.json()).toMatchObject({ stale: false, metar: { icao: 'LROP', category: 'VFR' } });
  });

  it('validates the ICAO code before any upstream call', async () => {
    const { wxFetch, core, weather } = setup();
    for (const bad of ['', 'LR', 'LROP1', 'L%2FOP', '1ROP']) {
      expect((await gateOp(core, 'metar', new URLSearchParams({ icao: bad }), weather)).status).toBe(400);
    }
    expect(wxFetch).not.toHaveBeenCalled();
  });
});
