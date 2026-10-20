# Changelog

All notable changes are listed here. The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and versions follow [SemVer](https://semver.org/).

## [Unreleased]

### Added
- Live worldwide map with GPU-instanced aircraft rendering, dead reckoning between updates and decluttered labels.
- Aircraft panel with route lookup and plausibility check, follow mode, watchlist and shareable deep links.
- Search (callsign, registration, hex, airports), filters with presets, airport layer and panel, sortable list.
- In-app alerts for emergency squawks and watched aircraft, with optional system notifications while open.
- Light/dark themes, units, six languages (EN, RO, DE, FR, ES, IT) with browser-language detection, PWA install, Capacitor Android project.
- Route progress bar with distance flown/to go and an estimated arrival time.
- Aircraft photos from Planespotters.net with photographer credit; airport weather (METAR) from NOAA via the Worker.
- Cloudflare Worker API with edge caching, a Durable Object request gate, coalescing, budgets, backoff and stale serving.
- CI: lint, typecheck, unit tests, Playwright e2e with axe accessibility checks, CodeQL, dependency audit, secret scan.
- Workflows for GitHub Pages, Worker deploy, and Android APK builds with SHA-256 checksums and tag releases.

### Changed
- The client paces cell refreshes to the shared upstream budget and fetches the oldest cells first; the "delayed" banner now appears only when data is actually old.
- Default upstream budget lowered to 0.75 req/s and 40/min to keep a margin under ADSB.lol's per-IP limits.
