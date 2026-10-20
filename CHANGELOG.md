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
- Aircraft photos from Planespotters.net with photographer credit; airport weather (METAR) from NOAA via the Worker.
- Cloudflare Worker API with edge caching, a Durable Object request gate, coalescing, budgets, backoff and stale serving.
- CI: lint, typecheck, unit tests, Playwright e2e with axe accessibility checks, CodeQL, dependency audit, secret scan.
- Workflows for GitHub Pages, Worker deploy, and Android APK builds with SHA-256 checksums and tag releases.
