# Assistant Orchestration Contract

This document defines the runtime contract shared by:
- Convex assistant flow (`convex/assistantChat.ts`)
- Next.js chatbot route (`src/app/api/assistant/chatbot/route.ts`)

## Deterministic Tool Routing

Routing is determined by `classifyAssistantQuery` (`src/lib/assistant-orchestration.ts`).

Rules:
1. External app phrases (Gmail, GitHub, Slack, Notion, ClickUp, Linear) mark the query as external intent.
2. If no external app phrases are detected, the query is treated as internal-only.
3. Hybrid mode is assigned when external intent and internal workspace signals both appear.

Runtime behavior:
- Convex flow: always enables internal tools; enables only requested external app tools when external intent is present.
- Next.js route: attempts Composio only for external-intent queries; otherwise uses Convex assistant directly.
- If external intent exists but Composio cannot run, route falls back to Convex and records fallback reason in metadata.

## Response Metadata Shape (v1)

Both execution paths return metadata under `metadata`:

- `schemaVersion`: `v1`
- `assistantType`: `convex` | `openai-composio`
- `executionPath`: `convex-assistant` | `nextjs-openai-composio`
- `intent`:
  - `mode`: `internal` | `external` | `hybrid`
  - `requiresExternalTools`: boolean
  - `requestedExternalApps`: string[]
- `tools`:
  - `internalEnabled`: boolean
  - `externalEnabled`: boolean
  - `externalUsed`: boolean
  - `connectedApps`: string[]
- `fallback`:
  - `attempted`: boolean
  - `reason`: string | null

This schema exists to keep behavior and observability aligned across both runtimes.
