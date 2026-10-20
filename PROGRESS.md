# Progress

Last updated: 2026-10-20. This file is the hand-off log: what is verified, what is not, and how to resume.

## Verified (with evidence)

| Item | How it was verified |
|---|---|
| Live data end to end | Local `wrangler dev` Worker → ADSB.lol → web app. Between 244 and 685 real aircraft rendered over Europe; aircraft panel, route lookup and search worked against live data. |
| Upstream protection | Gate unit tests with a fake clock (token bucket, coalescing, stale serving, backoff). With the budget exhausted, wide zooms return 503 and the client backs off. |
| Unit tests | shared 42, worker 31, web 16, all passing. |
| E2E + accessibility | Playwright (1 worker locally, 2 on CI): 8 specs × (desktop, Pixel 7), all passing twice in a row. Hermetic (basemap, API and photos are mocked). axe finds no serious or critical violations. |
| Typecheck / lint | `tsc` (TS 7) clean in all packages; `oxlint --deny-warnings` clean. |
| METAR + photos | Live: `/v1/metar/LROP` through the local Worker returned a real observation; a Planespotters photo with credit rendered in Chromium for a live aircraft (TC-RFD). |
| Six languages | e2e switches EN → RO → DE; `html[lang]` follows. |
| Public API Worker | Deployed 2026-10-20 to https://skywake-api.andrei1000z.workers.dev with `wrangler deploy`. `/v1/health` 200; `/v1/cell/33_51` returned 73 real aircraft; `/v1/metar/LROP` real METAR; CORS allows the Pages origin. |
| Route progress | Live RYR74AH OTP→CIA showed the progress bar, distance flown and to go, and ETA. Unit tests for leg selection. |
| Production web build | MapLibre worker emitted and loaded (`setWorkerUrl`). App chunk is about 26 KB gzip and MapLibre about 287 KB gzip. |

## Not verified yet (do not claim these)

- **Automated Worker deploys.** The Worker was deployed by hand (wrangler OAuth on the dev machine). The CI workflow still skips until `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` secrets exist. Until then, redeploy with `cd apps/worker && npx wrangler deploy`.
- **Public website with live data.** Pages can deploy, but without `SKYWAKE_API_BASE` it shows the "API not configured" banner.
- **Android APK install.** Java is not installed locally, so the APK is built only in CI. It has not yet been installed on a real device or emulator.
- **PWA install / offline shell** on real phones.
- **Capacity agreement with ADSB.lol.** Required before any promotion (docs/SUSTAINABILITY.md).
- **Planespotters from the Android WebView.** Works in desktop Chromium. The API rejects some non-browser user agents, so check it on a device.
- **DE/FR/ES/IT translations** need native-speaker review.
- **Release signing.** No keystore has been generated, so CI produces debug-signed APKs.

## Release gate (all must hold before calling a release production-ready)

1. The Worker is deployed and `/v1/health` responds from the public URL.
2. The Pages site loads live aircraft from that Worker, checked in a real browser.
3. A signed APK has been installed and launched on a real Android device and shows live aircraft.
4. CI is green: tests, e2e, CodeQL, audit and gitleaks.
5. The ADSB.lol capacity contact has been made and recorded.

Until then, every GitHub release is a **pre-release**.

## Resume instructions

```sh
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @skywake/web e2e        # needs: npx playwright install chromium
# local run: double-click Skywake-local.cmd (worker :8787 + web :5173)
```

Next steps, in order:

1. Complete the Cloudflare setup (owner action), then run the worker workflow and set `SKYWAKE_API_BASE`.
2. Re-run the Pages workflow and verify the public URL shows live aircraft.
3. Download the CI APK, install it on a device and record the result here.
4. Improvements: aircraft photos (licence check first), more languages, code-split panels.
