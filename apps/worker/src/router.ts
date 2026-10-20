import type { HealthResponse } from '@skywake/shared';
import type { Env } from './env.js';
import { ADSBLOL_ID } from './providers/adsblol.js';

/** Origins every deployment accepts: local dev and the Capacitor Android WebView. */
const BUILTIN_ORIGINS = ['http://localhost:5173', 'http://localhost:4173', 'https://localhost', 'capacitor://localhost'];

/** Seconds a successful response may sit in the Cloudflare edge cache / browser. */
const EDGE_TTL: Record<string, number> = { cell: 4, hex: 3, search: 10, emergencies: 20, route: 3600 };

export interface CacheLike {
  match(req: Request): Promise<Response | undefined>;
  put(req: Request, res: Response): Promise<void>;
}

export interface Ctx {
  waitUntil(p: Promise<unknown>): void;
}

function allowedOrigin(env: Env, origin: string | null): string | null {
  if (!origin) return null;
  const list = [...BUILTIN_ORIGINS, ...(env.ALLOWED_ORIGINS ?? '').split(',').map((s) => s.trim()).filter(Boolean)];
  return list.includes(origin) ? origin : null;
}

function withHeaders(res: Response, origin: string | null, extra: Record<string, string> = {}): Response {
  const out = new Response(res.body, res);
  out.headers.set('x-content-type-options', 'nosniff');
  out.headers.set('referrer-policy', 'no-referrer');
  out.headers.set('vary', 'Origin');
  if (origin) {
    out.headers.set('access-control-allow-origin', origin);
    out.headers.set('access-control-expose-headers', 'x-skywake-cache, retry-after');
  }
  for (const [k, v] of Object.entries(extra)) out.headers.set(k, v);
  return out;
}

const jsonError = (status: number, error: string, retryAfter?: number) =>
  new Response(JSON.stringify({ error, retryAfter }), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...(retryAfter ? { 'retry-after': String(retryAfter) } : {}),
    },
  });

interface Route {
  op: string;
  params: Record<string, string>;
}

export function matchRoute(pathname: string, search: URLSearchParams): Route | null {
  const parts = pathname.split('/').filter(Boolean);
  if (parts[0] !== 'v1') return null;
  const [, a, b] = parts;
  if (parts.length === 3 && a === 'cell' && b) return { op: 'cell', params: { id: b } };
  if (parts.length === 3 && a === 'aircraft' && b) return { op: 'hex', params: { hex: b } };
  if (parts.length === 3 && a === 'route' && b) return { op: 'route', params: { callsign: b } };
  if (parts.length === 2 && a === 'search') return { op: 'search', params: { q: search.get('q') ?? '' } };
  if (parts.length === 2 && a === 'emergencies') return { op: 'emergencies', params: {} };
  if (parts.length === 2 && a === 'health') return { op: 'health', params: {} };
  return null;
}

export async function handle(request: Request, env: Env, ctx: Ctx, cache: CacheLike | null): Promise<Response> {
  const url = new URL(request.url);
  const origin = allowedOrigin(env, request.headers.get('origin'));

  if (request.method === 'OPTIONS') {
    return withHeaders(new Response(null, { status: 204 }), origin, {
      'access-control-allow-methods': 'GET, OPTIONS',
      'access-control-allow-headers': 'content-type',
      'access-control-max-age': '86400',
    });
  }
  if (request.method !== 'GET' && request.method !== 'HEAD') return withHeaders(jsonError(405, 'method_not_allowed'), origin);
  if (url.pathname === '/' || url.pathname === '') {
    return withHeaders(
      new Response('Skywake API. Source and docs: https://github.com/andrei1000z/skywake\n', { headers: { 'content-type': 'text/plain' } }),
      origin,
    );
  }

  const route = matchRoute(url.pathname, url.searchParams);
  if (!route) return withHeaders(jsonError(404, 'not_found'), origin);

  // Normalised cache key: no query noise, no Origin (CORS headers are added per request).
  const cacheKeyUrl = new URL(url.origin + url.pathname);
  if (route.op === 'search') cacheKeyUrl.searchParams.set('q', route.params.q!.trim().toUpperCase());
  const cacheKey = new Request(cacheKeyUrl.toString(), { method: 'GET' });

  if (cache && route.op !== 'health') {
    const hit = await cache.match(cacheKey);
    if (hit) return withHeaders(hit, origin, { 'x-skywake-cache': 'edge' });
  }

  // Edge-cache misses reach the global gate; limit per client so one script can't drain the upstream budget.
  if (env.IP_LIMITER) {
    const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
    const { success } = await env.IP_LIMITER.limit({ key: ip });
    if (!success) return withHeaders(jsonError(429, 'client_rate_limited', 10), origin);
  }

  const stub = env.GATE.get(env.GATE.idFromName('global'));

  if (route.op === 'health') {
    const statsRes = await stub.fetch(`https://gate/stats`);
    const s = (await statsRes.json()) as {
      lastSuccess: number | null; lastError: string | null; lastErrorAt: number | null;
      requestsLastMinute: number; backoffUntil: number | null;
    };
    const now = Date.now();
    const body: HealthResponse = {
      service: 'skywake-api',
      version: env.VERSION ?? 'dev',
      now,
      providers: [{
        provider: ADSBLOL_ID,
        ok: s.backoffUntil === null && (s.lastErrorAt === null || (s.lastSuccess ?? 0) > s.lastErrorAt),
        lastSuccess: s.lastSuccess,
        lastError: s.lastError,
        lastErrorAt: s.lastErrorAt,
        requestsLastMinute: s.requestsLastMinute,
        backoffUntil: s.backoffUntil,
      }],
    };
    return withHeaders(new Response(JSON.stringify(body), { headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } }), origin);
  }

  const gateUrl = new URL(`https://gate/${route.op}`);
  for (const [k, v] of Object.entries(route.params)) gateUrl.searchParams.set(k, v);
  const res = await stub.fetch(gateUrl.toString());

  if (!res.ok) {
    return withHeaders(new Response(res.body, { status: res.status, headers: { ...Object.fromEntries(res.headers), 'cache-control': 'no-store' } }), origin);
  }

  const body = await res.text();
  const stale = body.includes('"stale":true');
  const ttl = stale ? 2 : (EDGE_TTL[route.op] ?? 2);
  const fresh = new Response(body, {
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': `public, max-age=${ttl}` },
  });
  if (cache) ctx.waitUntil(cache.put(cacheKey, fresh.clone()));
  return withHeaders(fresh, origin, { 'x-skywake-cache': 'miss' });
}
