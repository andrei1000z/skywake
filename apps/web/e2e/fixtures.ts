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
    if (p.startsWith('/v1/metar/')) {
      // Values from a real LROP observation (aviationweather.gov, 2026-10-20), re-stamped to now.
      const icao = p.split('/').pop();
      if (icao !== 'LROP') return json({ stale: false, metar: null });
      return json({
        stale: false,
        metar: {
          icao: 'LROP', obsTime: Date.now() - 600_000, raw: 'METAR LROP 201630Z 08004KT CAVOK 15/12 Q1023 NOSIG',
          tempC: 15, dewpointC: 12, windDir: 80, windKt: 4, visibilitySm: 6, visibilityPlus: true, qnhHpa: 1023, category: 'VFR', clouds: [],
        },
      });
    }
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

  // Basemap: a blank style served locally keeps the tests hermetic and independent of OpenFreeMap's latency.
  await page.route(/tiles\.openfreemap\.org\//, (route) => {
    const url = route.request().url();
    if (url.includes('/styles/')) {
      const dark = url.endsWith('/dark');
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        headers: CORS,
        body: JSON.stringify({
          version: 8,
          glyphs: 'https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf',
          sources: {},
          layers: [{ id: 'bg', type: 'background', paint: { 'background-color': dark ? '#0b1220' : '#f2f3f0' } }],
        }),
      });
    }
    // Empty glyph ranges are valid protobuf; labels simply render without text.
    return route.fulfill({ status: 200, contentType: 'application/x-protobuf', headers: CORS, body: Buffer.alloc(0) });
  });

  // Planespotters: tests must not call third-party services. Same response shape as the real API; the
  // image is a 1×1 placeholder served locally.
  await page.route(/api\.planespotters\.net\/pub\/photos\/hex\//, (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      headers: CORS,
      body: JSON.stringify({
        photos: [{
          id: '1',
          thumbnail_large: { src: 'https://t.plnspttrs.net/test/1_280.jpg', size: { width: 429, height: 280 } },
          link: 'https://www.planespotters.net/photo/1/test',
          photographer: 'Test Photographer',
        }],
      }),
    }),
  );
  await page.route(/plnspttrs\.net\//, (route) =>
    route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') }),
  );
}
