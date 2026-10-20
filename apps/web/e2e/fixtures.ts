import { normalizeReadsbResponse } from '@skywake/shared';
import type { Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

/**
 * A real ADSB.lol response captured over Bucharest (ODbL; test use only). Positions are re-stamped
 * to "now" so the app treats them as fresh; nothing else is altered.
 */
const raw = JSON.parse(
  readFileSync(new URL('../../../packages/shared/test/fixtures/adsblol-point-44.43-26.10-100nm.captured-2026-10-20.json', import.meta.url), 'utf8'),
) as Record<string, unknown>;

export function snapshot() {
  const now = Date.now();
  const shifted = { ...raw, now };
  return normalizeReadsbResponse(shifted, 'adsblol', now);
}

const CORS = { 'access-control-allow-origin': '*' };

export async function mockApi(page: Page) {
  await page.route(/:8787\/v1\//, async (route) => {
    const url = new URL(route.request().url());
    const snap = snapshot();
    const json = (body: unknown) => route.fulfill({ status: 200, contentType: 'application/json', headers: CORS, body: JSON.stringify(body) });
    const p = url.pathname;
    if (p.startsWith('/v1/cell/')) {
      const cell = p.split('/').pop()!;
      // Only the Bucharest cell has traffic in the snapshot; the rest are honestly empty.
      return json({ ts: snap.ts, stale: false, provider: 'adsblol', cell, aircraft: cell === '33_51' ? snap.aircraft : [] });
    }
    if (p.startsWith('/v1/aircraft/')) {
      const hex = p.split('/').pop();
      return json({ ts: snap.ts, stale: false, provider: 'adsblol', aircraft: snap.aircraft.filter((a) => a.hex === hex) });
    }
    if (p === '/v1/search') {
      const q = (url.searchParams.get('q') ?? '').toUpperCase();
      return json({ ts: snap.ts, stale: false, provider: 'adsblol', aircraft: snap.aircraft.filter((a) => a.callsign === q || a.reg === q) });
    }
    if (p === '/v1/emergencies') return json({ ts: snap.ts, stale: false, provider: 'adsblol', aircraft: [] });
    if (p.startsWith('/v1/route/')) return json({ stale: false, route: null });
    if (p === '/v1/health') {
      return json({
        service: 'skywake-api',
        version: 'test',
        now: Date.now(),
        providers: [{ provider: 'adsblol', ok: true, lastSuccess: Date.now(), lastError: null, lastErrorAt: null, requestsLastMinute: 1, backoffUntil: null }],
      });
    }
    return route.fulfill({ status: 404, headers: CORS, body: '{"error":"not_found"}' });
  });
}
