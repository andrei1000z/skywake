# Feature matrix

Legend: **✅ Working** (implemented and covered by automated tests or verified in a real browser) ·
**🟡 Partial** · **🔜 Planned** · **⛔ Blocked** (needs something outside the code, noted).

| Area | Feature | Status | Notes / verification |
|---|---|---|---|
| Map | Live aircraft, worldwide grid | ✅ | Real data verified locally through the Worker (685 aircraft over Europe at z5); e2e with captured real snapshot |
| Map | GPU rendering + smooth motion | ✅ | WebGL2 instanced layer, dead reckoning capped at 20 s, correction blending |
| Map | Light / dark basemap | ✅ | OpenFreeMap positron / dark; e2e theme switch |
| Map | Callsign labels with declutter | ✅ | Canvas overlay, zoom ≥ 6 |
| Map | Airports layer | ✅ | 9,611 airports from OurAirports |
| Map | Trail of selected aircraft | 🟡 | Only positions received since selection; no history backend |
| Map | Weather / radar overlay | 🔜 | Needs a source whose licence permits this use |
| Map | 3D view | 🔜 | |
| Data | ADSB.lol provider via Worker gate | ✅ | Budgets, coalescing, backoff, stale serving; 25 worker tests |
| Data | Route lookup + plausibility | ✅ | VRS standing data (CC0) |
| Data | Flight history / playback | ⛔ | Needs storage and a data agreement (ODbL share-alike applies to stored DBs) |
| Data | Scheduled arrivals / departures | ⛔ | No open schedule source with suitable licence found |
| Data | Aircraft photos | 🔜 | Pending licence review of a photo API |
| Data | Second provider (failover) | ⛔ | airplanes.live needs approval; OpenSky terms are non-commercial |
| UI | Aircraft panel | ✅ | e2e |
| UI | Airport panel + nearby traffic | ✅ | e2e |
| UI | Search (callsign, reg, hex, airport) | ✅ | e2e; upstream search through the Worker |
| UI | Filters + presets | ✅ | Unit-tested filter logic; e2e |
| UI | Sortable list of aircraft in view | ✅ | e2e |
| UI | Bookmarks, deep links, share | ✅ | URL round-trip e2e |
| UI | Follow mode | ✅ | Manual check |
| Alerts | Emergency squawk + watchlist, in-app | ✅ | Toasts; system notification while tab hidden |
| Alerts | Push while app closed | ⛔ | Needs a push service + server-side matching |
| Platform | Responsive / phone bottom sheet | ✅ | e2e on Pixel 7 profile |
| Platform | PWA install + offline shell | 🟡 | Manifest + service worker built; install not yet verified on a device |
| Platform | Android app (Capacitor) | 🟡 | Project, icons, signing config and CI build done; install on a real device not yet verified |
| Platform | i18n (EN, RO) | ✅ | e2e language switch |
| Platform | Accessibility | ✅ | axe: no serious/critical violations in main views (e2e) |
| Ops | CI (lint, types, tests, e2e, CodeQL, audit, secrets) | ✅ | Runs on GitHub Actions |
| Ops | Public Worker deployment | ⛔ | Waiting on Cloudflare credentials (see PROGRESS.md) |
| Ops | Public website | 🟡 | Pages workflow ready; live data needs the Worker URL |
