# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Design Context

This is Proddy, an agentic work-management suite (messaging, tasks, boards, canvas, notes, calendar, meetings, reports in one workspace). Register: **product** — design serves the task, not the pitch.

Before any design/UI work, read [PRODUCT.md](PRODUCT.md) for users, brand voice, design principles, and anti-references.

## Commands

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

## Architecture

Next.js 14 (App Router) frontend + Convex backend, real-time throughout. Liveblocks powers canvas collaboration, BlockNote is the notes/meeting-notes editor, Stream powers video meetings, Composio brokers third-party integrations (Slack/Linear/Todoist/Gmail/etc.), and the assistant layer uses the Vercel AI SDK against OpenAI.

### Backend (`convex/`)

Domain modules are grouped into subfolders rather than one flat directory — when looking for backend logic, go to the subfolder, not the root:

| Folder | Covers |
|---|---|
| `assistant/` | AI chat/tool-calling: `chat.ts`, `tools.ts`, `toolExecutor.ts`, `toolLoop.ts`, `composioTools.ts`, RAG retrieval, task drafting, title generation |
| `authn/` | Email OTP verification, password reset flows |
| `billing/` | Dodo Payments integration, plans, usage tracking, rate limiting, webhooks |
| `board/` | Kanban board + task dependency graph (`board.ts` is the largest single file in the repo) |
| `content/` | Notes, meeting notes, ProseMirror sync, rich text |
| `imports/` | Slack/Linear/Todoist import pipelines and OAuth integration wiring |
| `messaging/` | Channels, DMs, threads, reactions, mentions, typing/presence |
| `notify/` | Email sending (Resend), OneSignal push, in-app notifications |
| `planning/` | Calendar, milestones, projects, sprints, tasks |
| `search/` | AI search, hybrid RAG chat, keyword search |
| `workspace/` | Workspaces, members, invites, analytics, per-user/workspace preferences |
| `lib/` | Small cross-domain helpers (issue blocking, safe delete, utils) |

Root-level files: `schema.ts` (single ~46K schema for the whole app), `auth.ts`/`auth.config.ts` (Convex Auth), `http.ts` (HTTP actions/webhook endpoints), `crons.ts`, `convex.config.ts` (registers Convex components: `@convex-dev/presence`, `prosemirror-sync`, `rag`, `@dayhaysoos/convex-database-chat`, `@dodopayments/convex`).

`convex/` has its own `tsconfig.json` with `strict: true` — stricter than the root app config. `convex/_generated/` is generated output; never edit it. Per `AGENTS.md`, Convex-specific guidelines normally live at `convex/_generated/ai/guidelines.md` (generate/refresh via `npx convex ai-files install` if it's missing) — read it before writing Convex code if present, since it can override defaults learned from training data.

### Frontend (`src/`)

- `app/` — Next.js App Router routes, layouts, and `api/` route handlers.
- `features/<feature>/` — feature-scoped modules (`board`, `canvas`, `tasks`, `notes`, `calendar`, `chats`, `channels`, `messages`, `billing`, `imports`, `smart`, `reports`, `roadmap`, `sprints`, `workspaces`, etc.), each typically containing `api/` (Convex query/mutation hooks, e.g. `use-get-channels.ts`), `components/`, and `hooks/`/`utils/`/`types/`/`store/`/`contexts/` as needed. New feature work should follow this shape rather than putting logic in shared `components/`.
- `components/` — shared components, with `components/ui/` as the Shadcn/Radix primitives layer.
- `lib/` — utilities and integration clients; `composio-config.ts` (~50K) is the Composio tool/action config surface, large because it enumerates third-party integration schemas.
- `config/` — app-level config (e.g. Convex client provider setup).
- `middleware.ts` — Convex-Auth-aware Next.js middleware: gates `/workspace/*` behind auth, redirects authenticated users away from `/auth*` and `/`, passes OAuth import callback routes (`/api/import/{slack,todoist,linear}/callback`) through untouched, and unwraps Convex's wrapped error messages on `/api/auth` so the client gets a clean JSON error instead of an HTML 500 page.

### Naming conventions

| What | Convention | Example |
|---|---|---|
| Convex modules | camelCase | `workspaceInvites.ts`, `hybridRag.ts` |
| React components | kebab-case or PascalCase | `board-card.tsx`, `sign-in-card.tsx` |
| Hooks | `use-` prefix, kebab-case | `use-channel-id.ts`, `use-debounce.ts` |
| API routes | kebab-case dirs | `src/app/api/connections/`, `password-reset/` |
| Path alias | `@/` → `src/*` | `@/components`, `@/lib`, `@/hooks` |

### Review tooling

CodeRabbit (`coderabbit.yaml`) auto-reviews PRs against `main` with path-specific instructions for `src/app`, `src/components`, `src/features`, `convex`, and `src/lib`, and reads this file plus `AGENTS.md` as part of its knowledge base — keep both accurate. DeepSource (`.deepsource.toml`) runs a JS/TS+React analyzer against the same test patterns used above.

## Post-task reflection
When a task is complete (you've created a PR, the user says "done" or "ship it",
or the work is clearly finished), **draft the reflection yourself first** — 1–3
concrete things worth remembering (a decision, a gotcha, or a pattern), each
cited with the files / PR / commands / error-signatures it came from. Skip
entirely if nothing non-obvious happened.

Then, depending on how the session is running:

- **Interactive** (a person is at the keyboard): show your draft and ask one
  question before recording —

  > "Here's my reflection draft for the project memory: \<draft\>. Anything to
  > confirm, correct, or add before I record it? (Say 'skip' to drop it.)"

  Record the final text (with their corrections) via
  `verity reflect --user-input "<final reflection>" --kind <kind>`. If they say
  "skip", do not record.

- **Autonomous** (headless / CI / cron, or `VERITY_AUTONOMOUS=1`): record your
  draft directly, never blocking —
  `verity reflect --user-input "<your draft>" --kind <kind> --autonomous`.

<!-- verity-memory:start -->
## Project Memory

This project has a knowledge graph maintained at `.verity/memory/`. Before starting
non-trivial work, scan `.verity/memory/index.md` for decisions, gotchas, and patterns
that may apply to the change you are about to make. Open specific node files via
the Read tool when the title or scope suggests relevance.

The graph is auto-maintained by Verity. Files at `.verity/memory/_archive/` are
superseded — ignore them unless investigating history.

> Durable, hand-curated guidance goes in the preserve region below (it survives
> regeneration) or anywhere OUTSIDE these markers. Everything else between the
> markers is tool-owned and overwritten on each run.

<!-- verity-memory:preserve -->
<!-- Add binding, hand-curated guidance here; it survives Verity regeneration. -->
<!-- /verity-memory:preserve -->
<!-- verity-memory:end -->
