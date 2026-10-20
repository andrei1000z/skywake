# Security policy

## Reporting a vulnerability

Please **do not open a public issue**. Report privately through
[GitHub Security Advisories](https://github.com/andrei1000z/skywake/security/advisories/new).
You should get an acknowledgement within 7 days. Fixes are released as soon as they are ready, and reporters are
credited unless they prefer otherwise.

## Scope

- The web app and PWA (`apps/web`), the Android app, and the API Worker (`apps/worker`).
- Abuse vectors against upstream providers through our API (amplification, cache-busting, budget bypass) are in scope
  and especially welcome.

## Design notes

- The API is read-only, has no accounts and stores no personal data. Request parameters are validated with strict
  allowlists, and errors never echo upstream bodies.
- CORS is restricted to known origins, there is a per-IP rate limit on cache misses, and all upstream traffic passes
  through a single budgeted gate.
- The web app stores preferences only in the browser's `localStorage`. There is no analytics or third-party tracking.
  The location button uses the browser geolocation API to centre the map, and the position never leaves the device.
- Release APKs are signed with a key that exists only in CI secrets. Every release ships SHA-256 checksums.
