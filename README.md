<p align="center">
  <img src="apps/web/public/icon.svg" width="72" height="72" alt="">
</p>

<h1 align="center">Skywake</h1>

<p align="center">
  A free, open-source live flight tracker for the web and Android.<br>
  No ads, no accounts, no tracking. Built on community ADS-B data.
</p>

<p align="center">
  <a href="https://github.com/andrei1000z/skywake/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/andrei1000z/skywake/actions/workflows/ci.yml/badge.svg"></a>
  <a href="LICENSE"><img alt="License: AGPL-3.0-or-later" src="https://img.shields.io/badge/license-AGPL--3.0--or--later-blue"></a>
</p>

> **Status: pre-release (0.x).** The web app and API work end to end with real data in local and CI testing.
> Public hosting and the Android APK are still being verified. See [PROGRESS.md](PROGRESS.md) for the exact state,
> and [FEATURE_MATRIX.md](FEATURE_MATRIX.md) for what works, what is partial and what is planned.

## What it does

- **Live map** of aircraft worldwide where volunteer receivers have coverage. It is GPU-rendered, so thousands of aircraft stay smooth, and motion is dead-reckoned between updates.
- **Aircraft details:** callsign, registration, type, altitude, speed, vertical rate, squawk, position source (ADS-B / MLAT / TIS-B…) and data age.
- **Route** (origin → destination) from a community callsign database, with a plausibility check against the aircraft's actual position. The route is shown as unconfirmed when it doesn't fit.
- **Search** by callsign, registration, ICAO hex or airport (about 9,600 airports).
- **Filters:** altitude, speed, airline prefix, type (with wildcards), category, position source, ground/airborne, emergencies, military. Save filter combinations as presets.
- **Airports** layer, airport panel with nearby traffic, and a sortable list of aircraft in view.
- **Alerts** for emergency squawks (7500/7600/7700) and for a personal watchlist, while the app is open (see [limitations](#honest-limitations)).
- **Trails** for the selected aircraft, plus follow mode, shareable deep links and bookmarks.
- **Light and dark** themes, metric or imperial units, and English and Romanian.
- **Installable:** PWA on desktop and phone, plus a native Android app.
- **Accessible:** keyboard navigation, screen-reader labels and reduced-motion support. axe checks run in CI.

## Architecture in one paragraph

The browser never calls the volunteer data provider directly. A **Cloudflare Worker** sits between users and
[ADSB.lol](https://adsb.lol) and does three jobs:

- caches each response at the edge for a few seconds, so many users share one upstream request;
- funnels every cache miss through one **Durable Object** that coalesces identical requests and enforces a strict request budget (below ADSB.lol's published limits), backing off on errors;
- serves slightly stale data instead of hammering the provider when it is busy.

The world is split into fixed 4°×4° cells, so requests from different users line up and share a cache.
The web app is React + MapLibre GL, and aircraft are drawn by a custom WebGL2 instanced layer.
Details: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

```
browser / Android ──► Worker (edge cache) ──► Durable Object gate (budget, coalescing, backoff) ──► ADSB.lol
```

## Run it locally

Requirements: Node 22+ and pnpm 10.

```sh
pnpm install
pnpm dev            # API on http://localhost:8787, web on http://localhost:5173
```

On Windows you can also double-click `Skywake-local.cmd`.

Checks: `pnpm lint && pnpm typecheck && pnpm test`. For end-to-end tests: `pnpm --filter @skywake/web e2e`.
The e2e tests use a captured real snapshot, so they never call ADSB.lol.

## Deploy your own

See [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md). In short:

1. Deploy the Worker with `wrangler deploy` (Cloudflare free plan).
2. Set the repository variable `SKYWAKE_API_BASE` to the Worker URL.
3. Enable GitHub Pages ("GitHub Actions" source).

If you plan meaningful traffic, **talk to the data provider first**. ADSB.lol asks production users to get in touch.

## Honest limitations

- **Coverage is only as good as the volunteer receivers.** It is thin over oceans and in parts of Africa, Asia and South America.
- **No history or playback yet.** Trails start when you open an aircraft.
- **Routes come from a community callsign database** and can be wrong or outdated. Skywake flags routes that don't fit the aircraft's position, but cannot guarantee them.
- **There are no push notifications when the app is closed.** Alerts work only while Skywake is open, because there is no push server.
- **Shared capacity is limited.** Upstream requests are budgeted (about 50/min per deployment) out of respect for the volunteer service. With many users looking at different parts of the world, distant areas refresh more slowly. Scaling beyond that needs an agreement with the data provider. See [docs/SUSTAINABILITY.md](docs/SUSTAINABILITY.md).
- **Some aircraft are hidden or anonymised upstream** at their owners' request (e.g. LADD/PIA).

Skywake is not for navigation, safety-of-life or any operational aviation use.

## Data and credits

Flight data: [ADSB.lol](https://adsb.lol), [ODbL 1.0](https://opendatacommons.org/licenses/odbl/1-0/).
Routes: [VRS standing data](https://github.com/vradarserver/standing-data) (CC0).
Airports: [OurAirports](https://ourairports.com/data/) (public domain).
Basemap: [OpenFreeMap](https://openfreemap.org), [OpenMapTiles](https://openmaptiles.org), © [OpenStreetMap contributors](https://www.openstreetmap.org/copyright).
Full details and obligations: [DATA_SOURCES.md](DATA_SOURCES.md).

Do you have an antenna? [Feed ADSB.lol](https://adsb.lol/feed) and improve coverage for everyone.

## Contributing

Issues and pull requests are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) and the
[Code of Conduct](CODE_OF_CONDUCT.md). For security reports, see [SECURITY.md](SECURITY.md).

## How this was built

Skywake was built by its maintainer with substantial help from an AI coding assistant (Claude by Anthropic).
Every change is reviewed and tested: unit tests, end-to-end tests and accessibility checks run on every push.
See [docs/PRESS_KIT.md](docs/PRESS_KIT.md#ai-assisted-development).

## License

[GNU AGPL-3.0-or-later](LICENSE). If you run a modified version as a public service, you must share your changes.
Data keeps its own licences ([DATA_SOURCES.md](DATA_SOURCES.md)).
