# Skywake: notes for Claude

Open-source flight tracker. pnpm monorepo: `packages/shared` (pure types, normalisation, grid), `apps/worker` (Cloudflare Worker + DO `UpstreamGate`), `apps/web` (React 19 + Vite 8/rolldown + MapLibre 6 + Capacitor Android).

## Commands
- `pnpm lint` (oxlint), `pnpm typecheck`, `pnpm test`, `pnpm --filter @skywake/web e2e`, `pnpm --filter @skywake/web build`.
- Local dev: `Skywake-local.cmd`, or `wrangler dev --port 8787` in apps/worker plus `vite --port 5173` in apps/web.

## Hard rules
- Never fake data, metrics, screenshots or deployment success. Update PROGRESS.md with evidence.
- All upstream traffic goes through the gate. Never call ADSB.lol directly from the client.
- Releases stay pre-releases until the release gate in PROGRESS.md passes.
- Never commit keystores or secrets.

## Gotchas
- MapLibre 6 has no default export: use `import * as maplibregl`. The worker must be set via `?url` import + `setWorkerUrl`, or the prod build has no worker.
- typescript-eslint does not support TS 7, hence oxlint.
- vitest uses the `node` env (the jsdom worker timed out on Windows).
- In production, `VITE_API_BASE` must be set at build time; without it the app shows `api_not_configured`.
- E2E mocks `:8787/v1/` and needs a CORS header in the mock.
