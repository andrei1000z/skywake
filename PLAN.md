# Plan

## Goal

A free, open-source, privacy-respecting live flight tracker that people can rely on, on the web and on Android.
It is built only on openly licensed data and is careful with the volunteer services it depends on.

## Principles

1. **Real data only.** Show what is known, mark what is uncertain, and never fill gaps with invented numbers.
2. **One gate to upstream.** All provider traffic passes through a budgeted, caching, coalescing gateway.
3. **Fast on cheap phones.** The GPU draws aircraft, the main thread stays mostly idle, and repaint adapts to motion.
4. **No accounts, no tracking.** Preferences stay on the device.
5. **Honest status.** Features are marked working only when tests or real-browser checks back them up.

## Phases

| Phase | Scope | State |
|---|---|---|
| 0. Foundations | Monorepo, shared types and normalisation, grid, tests on captured real data | Done |
| 1. API | Worker + Durable Object gate, edge cache, CORS, rate limits, health | Done (local); deploy pending credentials |
| 2. Web app | Map, layer, labels, panels, search, filters, alerts, i18n, a11y, PWA | Done; verified in Chromium with real data |
| 3. Quality | Unit + e2e + axe, lint, CodeQL, secret scan, dependency audit | Done |
| 4. Distribution | Pages, Android APK with checksums and signed releases | Workflows ready; first runs pending |
| 5. Public launch | Provider agreement for capacity, device testing, first tagged release | Next |
| 6. Beyond | Photos, history (with storage + licence plan), push alerts, more languages, 3D | Later |

## Key risks

| Risk | Mitigation |
|---|---|
| Upstream capacity (≈50 req/min budget per deployment) | Grid-aligned shared cache, coalescing, stale serving; contact ADSB.lol before promotion; document clearly |
| Provider outage | Stale serving with clear banner; second provider only once properly licensed |
| Tile host policy changes | OpenFreeMap requires no key; style URLs are in one place and easy to swap |
| WebGL2 unavailable | Clear message instead of a broken map |
