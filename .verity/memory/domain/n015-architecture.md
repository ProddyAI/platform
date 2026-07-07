---
schema: 1
id: n015-architecture
kind: domain
title: "Architecture"
confidence: 0.6
status: active
source: extractor
created_by: seed
created_at: 2026-07-07T06:30:43.280Z
updated_at: 2026-07-07T06:30:43.280Z
---

# Architecture

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

`convex/` has its own `tsconfig.json` with `strict: true` — stricter than the root app config. `convex/_generated/` is ge

_Seeded from CLAUDE.md. Edit or archive if outdated._
