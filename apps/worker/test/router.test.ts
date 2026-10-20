import { describe, expect, it, vi } from 'vitest';
import type { Env } from '../src/env.js';
import { GateCore } from '../src/gate-core.js';
import { gateOp } from '../src/gate-ops.js';
import { type CacheLike, handle, matchRoute } from '../src/router.js';

const okBody = JSON.stringify({ now: Date.now(), ac: [{ hex: 'abc123', lat: 44, lon: 26, seen_pos: 0 }] });

function makeEnv(upstream: () => Response = () => new Response(okBody), limiterOk = true) {
  const fetchFn = vi.fn(async () => upstream());
  const core = new GateCore({ rps: 10, burst: 10, perMinute: 100, perDay: 0 }, fetchFn as unknown as typeof fetch);
  const env: Env = {
    ALLOWED_ORIGINS: 'https://example.github.io',
    IP_LIMITER: { limit: vi.fn(async () => ({ success: limiterOk })) },
    GATE: {
      idFromName: () => 'id',
      get: () => ({
        fetch: async (input: string | Request) => {
          const u = new URL(typeof input === 'string' ? input : input.url);
          return gateOp(core, u.pathname.slice(1), u.searchParams);
        },
      }),
    },
  };
  return { env, fetchFn };
}

class MemCache implements CacheLike {
  store = new Map<string, Response>();
  async match(r: Request) { return this.store.get(r.url)?.clone(); }
  async put(r: Request, res: Response) { this.store.set(r.url, res); }
}

const ctx = { waitUntil: (p: Promise<unknown>) => void p };
const get = (path: string, origin?: string) => new Request(`https://api.test${path}`, { headers: origin ? { origin } : {} });

describe('router', () => {
  it('matches only known routes', () => {
    expect(matchRoute('/v1/cell/33_51', new URLSearchParams())).toEqual({ op: 'cell', params: { id: '33_51' } });
    expect(matchRoute('/v1/cell/33_51/extra', new URLSearchParams())).toBeNull();
    expect(matchRoute('/v2/cell/1_1', new URLSearchParams())).toBeNull();
    expect(matchRoute('/v1/search', new URLSearchParams('q=x'))).toEqual({ op: 'search', params: { q: 'x' } });
  });

  it('applies CORS only to allowed origins', async () => {
    const { env } = makeEnv();
    const ok = await handle(get('/v1/cell/33_51', 'https://example.github.io'), env, ctx, null);
    expect(ok.headers.get('access-control-allow-origin')).toBe('https://example.github.io');
    const cap = await handle(get('/v1/cell/33_51', 'https://localhost'), env, ctx, null);
    expect(cap.headers.get('access-control-allow-origin')).toBe('https://localhost');
    const evil = await handle(get('/v1/cell/33_51', 'https://evil.example'), env, ctx, null);
    expect(evil.headers.get('access-control-allow-origin')).toBeNull();
  });

  it('answers preflight without hitting upstream', async () => {
    const { env, fetchFn } = makeEnv();
    const res = await handle(new Request('https://api.test/v1/cell/1_1', { method: 'OPTIONS', headers: { origin: 'https://example.github.io' } }), env, ctx, null);
    expect(res.status).toBe(204);
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it('rejects writes and unknown paths', async () => {
    const { env } = makeEnv();
    expect((await handle(new Request('https://api.test/v1/cell/1_1', { method: 'POST' }), env, ctx, null)).status).toBe(405);
    expect((await handle(get('/v1/nope'), env, ctx, null)).status).toBe(404);
  });

  it('serves the second request from the edge cache', async () => {
    const { env, fetchFn } = makeEnv();
    const cache = new MemCache();
    const r1 = await handle(get('/v1/cell/33_51'), env, ctx, cache);
    expect(r1.headers.get('x-skywake-cache')).toBe('miss');
    expect(r1.headers.get('cache-control')).toBe('public, max-age=4');
    await new Promise((r) => setTimeout(r, 0));
    const r2 = await handle(get('/v1/cell/33_51?junk=1'), env, ctx, cache);
    expect(r2.headers.get('x-skywake-cache')).toBe('edge');
    expect(fetchFn).toHaveBeenCalledTimes(1);
  });

  it('returns 429 when the per-client limiter trips', async () => {
    const { env } = makeEnv(undefined, false);
    const res = await handle(get('/v1/cell/33_51'), env, ctx, null);
    expect(res.status).toBe(429);
    expect(res.headers.get('retry-after')).toBe('10');
  });

  it('propagates upstream outages as non-cacheable 5xx with Retry-After', async () => {
    const { env } = makeEnv(() => new Response('down', { status: 503 }));
    const res = await handle(get('/v1/cell/33_51'), env, ctx, new MemCache());
    expect(res.status).toBe(503);
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(res.headers.get('retry-after')).toBeTruthy();
  });

  it('health reports provider state', async () => {
    const { env } = makeEnv();
    await handle(get('/v1/cell/33_51'), env, ctx, null);
    const res = await handle(get('/v1/health'), env, ctx, null);
    const body = (await res.json()) as { service: string; providers: { provider: string; ok: boolean; requestsLastMinute: number }[] };
    expect(body.service).toBe('skywake-api');
    expect(body.providers[0]).toMatchObject({ provider: 'adsblol', ok: true, requestsLastMinute: 1 });
  });
});
