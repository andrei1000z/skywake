import { describe, expect, it, vi } from 'vitest';
import { GateCore, type UpstreamRequest } from '../src/gate-core.js';
import { gateOp } from '../src/gate-ops.js';

const limits = { rps: 1, burst: 3, perMinute: 50, perDay: 0 };
const okBody = JSON.stringify({ now: 1000, ac: [{ hex: 'abc123', lat: 44, lon: 26, seen_pos: 0 }] });

function setup(responder: (url: string) => Response | Promise<Response>, lim = limits) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms: number) => (t += ms) };
  const fetchFn = vi.fn(async (url: string | URL | Request) => responder(String(url)));
  const core = new GateCore(lim, fetchFn as unknown as typeof fetch, clock.now);
  return { core, fetchFn, clock };
}

const req = (key = 'k', ttlMs = 10_000): UpstreamRequest => ({ key, url: `https://up/${key}`, ttlMs, transform: (r) => r });

describe('GateCore', () => {
  it('coalesces concurrent identical requests into one upstream call', async () => {
    const { core, fetchFn } = setup(() => new Response(okBody));
    const results = await Promise.all(Array.from({ length: 20 }, () => core.get(req())));
    expect(fetchFn).toHaveBeenCalledTimes(1);
    expect(results.every((r) => r.ok && !r.stale)).toBe(true);
  });

  it('serves from cache within TTL and refetches after', async () => {
    const { core, fetchFn, clock } = setup(() => new Response(okBody));
    await core.get(req());
    clock.advance(5_000);
    await core.get(req());
    expect(fetchFn).toHaveBeenCalledTimes(1);
    clock.advance(6_000);
    await core.get(req());
    expect(fetchFn).toHaveBeenCalledTimes(2);
  });

  it('enforces the token bucket and serves stale data when over budget', async () => {
    const { core, fetchFn, clock } = setup(() => new Response(okBody), { ...limits, burst: 2 });
    await core.get(req('a', 0));
    await core.get(req('b', 0));
    const third = await core.get(req('a', 0));
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(third).toMatchObject({ ok: true, stale: true });
    const unknown = await core.get(req('c', 0));
    expect(unknown).toMatchObject({ ok: false, status: 503, error: 'rate_budget_exhausted' });
    clock.advance(1_000);
    expect((await core.get(req('c', 0))).ok).toBe(true);
  });

  it('enforces the per-minute cap', async () => {
    const { core, fetchFn, clock } = setup(() => new Response(okBody), { rps: 100, burst: 100, perMinute: 5, perDay: 0 });
    for (let i = 0; i < 10; i++) await core.get(req(`k${i}`, 0));
    expect(fetchFn).toHaveBeenCalledTimes(5);
    clock.advance(60_000);
    await core.get(req('z', 0));
    expect(fetchFn).toHaveBeenCalledTimes(6);
  });

  it('enforces the daily cap when configured', async () => {
    const { core, fetchFn } = setup(() => new Response(okBody), { rps: 100, burst: 100, perMinute: 100, perDay: 3 });
    for (let i = 0; i < 6; i++) await core.get(req(`k${i}`, 0));
    expect(fetchFn).toHaveBeenCalledTimes(3);
  });

  it('backs off after 429 honouring Retry-After, serving stale meanwhile', async () => {
    let status = 200;
    const { core, fetchFn, clock } = setup(() => (status === 200 ? new Response(okBody) : new Response('slow down', { status, headers: { 'retry-after': '30' } })));
    await core.get(req('a', 1000));
    status = 429;
    clock.advance(2_000);
    const r = await core.get(req('a', 1000));
    expect(r).toMatchObject({ ok: true, stale: true });
    expect(core.stats().backoffUntil).toBeGreaterThan(clock.now() + 29_000);
    clock.advance(10_000);
    await core.get(req('a', 1000));
    expect(fetchFn).toHaveBeenCalledTimes(2); // no call during backoff
    clock.advance(25_000);
    status = 200;
    expect(await core.get(req('a', 1000))).toMatchObject({ ok: true, stale: false });
  });

  it('reports outage without cache as 503/502 and never throws', async () => {
    const { core } = setup(() => { throw new TypeError('network down'); });
    const r = await core.get(req());
    expect(r).toMatchObject({ ok: false, status: 502, error: 'upstream_unreachable' });
    expect(core.stats().lastError).toContain('network');
  });

  it('gives up serving stale data after 10 minutes', async () => {
    let fail = false;
    const { core, clock } = setup(() => (fail ? new Response('x', { status: 500 }) : new Response(okBody)));
    await core.get(req('a', 1000));
    fail = true;
    clock.advance(11 * 60_000);
    expect((await core.get(req('a', 1000))).ok).toBe(false);
  });

  it('treats malformed payloads as upstream faults', async () => {
    const { core } = setup(() => new Response('<html>'));
    const r = await core.get({ ...req(), transform: (raw) => JSON.stringify(JSON.parse(raw)) });
    expect(r).toMatchObject({ ok: false, error: 'upstream_bad_payload' });
  });

  it('does not back off the provider on a plain 4xx', async () => {
    const { core } = setup(() => new Response('nope', { status: 400 }));
    await core.get(req());
    expect(core.stats().backoffUntil).toBeNull();
  });

  it('caches 404 as empty when allowed', async () => {
    const { core, fetchFn } = setup(() => new Response('', { status: 404 }));
    const r1 = await core.get({ ...req(), notFoundIsEmpty: true, transform: (raw) => (raw ? raw : 'null') });
    const r2 = await core.get({ ...req(), notFoundIsEmpty: true, transform: (raw) => (raw ? raw : 'null') });
    expect(r1).toMatchObject({ ok: true, body: 'null' });
    expect(r2.ok).toBe(true);
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('sends an identifying User-Agent', async () => {
    const { core, fetchFn } = setup(() => new Response(okBody));
    await core.get(req());
    const init = fetchFn.mock.calls[0]![1 as never] as RequestInit;
    expect(new Headers(init.headers).get('user-agent')).toMatch(/^Skywake\//);
  });
});

describe('gateOp', () => {
  it('validates input before touching upstream', async () => {
    const { core, fetchFn } = setup(() => new Response(okBody));
    for (const [op, p] of [['cell', 'id=99_99'], ['cell', 'id=../x'], ['hex', 'hex=xyz'], ['search', 'q=%3Cscript%3E'], ['route', 'callsign=a/b']] as const) {
      const res = await gateOp(core, op, new URLSearchParams(p));
      expect(res.status).toBe(400);
    }
    expect((await gateOp(core, 'nope', new URLSearchParams())).status).toBe(404);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('builds the ADSB.lol point query for a cell and returns a CellResponse', async () => {
    const { core, fetchFn } = setup(() => new Response(okBody));
    const res = await gateOp(core, 'cell', new URLSearchParams('id=33_51'));
    const body = await res.json();
    expect(String(fetchFn.mock.calls[0]![0])).toMatch(/^https:\/\/api\.adsb\.lol\/v2\/point\/44\.0000\/26\.0000\/\d+$/);
    expect(body).toMatchObject({ cell: '33_51', provider: 'adsblol', stale: false, aircraft: [{ hex: 'abc123' }] });
  });

  it('search merges callsign and registration lookups', async () => {
    const { core, fetchFn } = setup((url) =>
      new Response(JSON.stringify({ now: 1000, ac: [{ hex: url.includes('/callsign/') ? '111111' : '222222', lat: 1, lon: 1, seen_pos: 0 }] })),
    );
    const res = await gateOp(core, 'search', new URLSearchParams('q=yrabc'));
    const body = (await res.json()) as { aircraft: { hex: string }[] };
    expect(fetchFn).toHaveBeenCalledTimes(2);
    expect(body.aircraft.map((a) => a.hex).sort()).toEqual(['111111', '222222']);
  });

  it('route returns null for unknown callsigns', async () => {
    const { core } = setup(() => new Response('', { status: 404 }));
    const res = await gateOp(core, 'route', new URLSearchParams('callsign=ZZZ999'));
    expect(await res.json()).toEqual({ stale: false, route: null });
  });

  it('route parses VRS standing data', async () => {
    const vrs = {
      callsign: 'VIR157L',
      _airports: [
        { icao: 'EGLL', iata: 'LHR', name: 'London Heathrow Airport', location: 'London', countryiso2: 'GB', lat: 51.47, lon: -0.46 },
        { icao: 'KBOS', iata: 'BOS', name: 'Logan', location: 'Boston', countryiso2: 'US', lat: 42.36, lon: -71.0 },
      ],
    };
    const { core, fetchFn } = setup(() => new Response(JSON.stringify(vrs)));
    const res = await gateOp(core, 'route', new URLSearchParams('callsign=VIR157L'));
    expect(String(fetchFn.mock.calls[0]![0])).toBe('https://vrs-standing-data.adsb.lol/routes/VI/VIR157L.json');
    const body = (await res.json()) as { route: { airports: { iata: string }[] } };
    expect(body.route.airports.map((a) => a.iata)).toEqual(['LHR', 'BOS']);
  });
});
