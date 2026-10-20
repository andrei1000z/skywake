# Contributing to Skywake

Thanks for helping. Skywake aims to be a dependable public tool, so changes are held to a few firm rules.

## Ground rules

1. **Never fake data.** No simulated aircraft, invented routes or placeholder numbers in anything a user can see.
   Tests use captured real responses (see `packages/shared/test/fixtures/`).
2. **Be kind to volunteer infrastructure.** Every upstream request goes through the Worker's gate
   (`apps/worker/src/gate-core.ts`). Don't add direct calls from the browser to data providers, and don't raise
   budgets without a written agreement from the provider.
3. **Respect licences.** New data sources need an entry in [DATA_SOURCES.md](DATA_SOURCES.md) in the same PR.
   Never copy code, icons or branding from proprietary trackers.
4. **No secrets in the repo.** Keys and signing material live only in GitHub/Cloudflare secrets.
5. **Accessibility is not optional.** New UI must work with a keyboard, have labels, and pass the axe checks in e2e.

## Setup

```sh
pnpm install
pnpm dev                                # worker :8787 + web :5173
pnpm lint && pnpm typecheck && pnpm test
pnpm --filter @skywake/web e2e          # Playwright, uses mocked API with real captured data
```

## Layout

| Path | What |
|---|---|
| `packages/shared` | Types, normalisation of upstream data, grid maths, filters (pure, fully tested) |
| `apps/worker` | Cloudflare Worker API + Durable Object gate |
| `apps/web` | React + MapLibre web app, PWA, Capacitor Android project |
| `scripts/` | Data build scripts (airports) |

## Pull requests

- Keep PRs focused. Describe the user-visible change and how you tested it.
- Add or update tests. Bug fixes need a test that fails without the fix.
- Update `CHANGELOG.md` under *Unreleased* and `FEATURE_MATRIX.md` if a feature's status changes.
- CI must be green: lint, typecheck, unit tests, e2e + accessibility, build, CodeQL, secret scan.

## Translations

Strings live in `apps/web/src/lib/i18n.ts`. To add a language, copy the `en` block, translate every key
(TypeScript will flag missing keys), and add it to the language selector in `MapPanel.tsx`.
