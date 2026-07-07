---
schema: 1
id: n014-commands
kind: domain
title: "Commands"
confidence: 0.6
status: active
source: extractor
created_by: seed
created_at: 2026-07-07T06:30:43.280Z
updated_at: 2026-07-07T06:30:43.280Z
---

# Commands

Package manager is **Bun** (`bun@1.3.6`, see `packageManager` in `package.json`). Node >=20 required.

```bash
bun i                  # install dependencies
bun next               # Next.js dev server (turbo + https) — https://localhost:3000
bun convex             # Convex dev server (run alongside `bun next`, separate terminal)
bun run type           # tsc --noEmit — full project typecheck
bun run check          # biome check --write --unsafe . — lint + format, auto-fixes in place
bun test tests         # run the full test suite (bun:test)
bun run build          # tsc --noEmit && next build
bun start              # start production build
```

Run a single test file: `bun test tests/convex/assistant/relativeDate.test.ts`. Tests use `bun:test` (`describe`/`test`/`expect` from `"bun:test"`) and live under `tests/`, mirroring the source path they cover (e.g. `convex/assistant/relativeDate.ts` → `tests/convex/assistant/relativeDate.test.ts`), not colocated with source.

There is no separate lint script — Biome (`biome.json`) handles both lint and format via `bun run check`. Formatting: tabs, double quotes, semicolons, ES5 trailing commas, 80-char lines. Import order and attribute sorting are auto-fixed by Biome's `assist.actions.source`.

CI (`.github/workflows/`):
- `typecheck.yml` runs `bun run type` on every PR and push to `main`.
- `deploy-convex-production.yml` **auto-deploys the Convex backend to production on every push to `main`** (`bunx convex deploy -y`, no staging gate). Treat merges to `main` that touch `convex/**` as immediate production deploys.

_Seeded from CLAUDE.md. Edit or archive if outdated._
