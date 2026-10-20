# Architecture

## Request path

```
Browser / Android WebView
   │  GET /v1/cell/33_51   (one 4°×4° cell)
   ▼
Cloudflare Worker (router.ts)
   ├─ CORS allowlist, method/path validation, per-IP limiter on cache misses
   ├─ Edge Cache API (TTL: cell 4 s, hex 3 s, search 10 s, emergencies 20 s, route 1 h)
   ▼  miss
Durable Object "UpstreamGate" (single global instance, gate-core.ts)
   ├─ in-memory cache (cell 10 s, hex 5 s, …) + stale copies up to 10 min
   ├─ request coalescing (identical in-flight requests share one fetch)
   ├─ token bucket: 1 req/s, burst 3, 50/min (configurable, below ADSB.lol's 4/s and 60/min)
   ├─ backoff on 429/5xx honouring Retry-After; 8 s timeout
   ▼
ADSB.lol  /v2/point/{lat}/{lon}/{radius}
```

When the budget is exhausted, the gate returns the newest stale copy (`"stale": true`), or `503` with
`retryAfter` if it has none. The client backs off per cell and shows a "data delayed" banner.

## Grid

The world is split into 45 × 90 fixed cells of 4°. Each cell is one ADSB.lol point query, with a radius that
covers the cell's corners (≤ 250 nm). The client loads up to 24 cells nearest the viewport centre. Because the
cells are fixed, users looking at the same region hit the same cache keys. The grid handles the antimeridian.

## Client

- `LiveStore` polls visible cells with an 8 s refresh and a concurrency of 4. It stops when the tab is hidden and prunes aircraft not seen for 30–45 s. Each aircraft is kept in Web Mercator space, with a velocity derived from ground speed and track.
- `AircraftLayer` is a MapLibre custom layer (WebGL2, instanced). Extrapolation runs in the vertex shader, so the CPU does no per-frame work for motion. It repaints quickly while the map moves and slowly otherwise, to save battery.
- `LabelOverlay` is a 2D canvas that declutters labels greedily.
- Panels are plain React. State lives in `prefs` (localStorage) and in the URL hash (`#map=z/lat/lon&ac=hex&ap=ICAO`).

## Packages

- `@skywake/shared`: types, readsb normalisation (validates every field), grid, geo maths and filters. Pure code, fully unit-tested.
- `@skywake/worker`: router, gate core (pure, tested with a fake clock), provider adapters and the Durable Object wrapper.
- `@skywake/web`: the app, PWA assets, the Capacitor Android project and the Playwright e2e tests.
