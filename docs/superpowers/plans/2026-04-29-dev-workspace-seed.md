# Dev Workspace Seed Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a temporary one-off Convex mutation that populates an empty dev workspace with realistic assistant-test data and schedules indexing.

**Architecture:** Implement a single temporary Convex mutation in a new file that inserts records directly into the current schema using one workspace owner/member context. Keep all seeded data labeled and self-contained so the file can be deleted after execution while leaving persisted records in the dev DB.

**Tech Stack:** Convex mutations, existing workspace/channel/task/note/message/card/event schema, existing `ragchat` indexing actions.

---

### Task 1: Add Temporary Dev Seed Mutation

**Files:**
- Create: `convex/devSeed.ts`
- Modify: `convex/_generated/api.d.ts`
- Modify: `convex/_generated/api.js`

- [ ] **Step 1: Add one temporary mutation that seeds a workspace**

Create a mutation that:
- accepts `workspaceId`
- loads the workspace and owner member
- ensures seed channels/lists exist
- inserts seed messages, notes, tasks, cards, and one event
- schedules `ragchat.autoIndexMessage`, `autoIndexNote`, `autoIndexTask`, `autoIndexCard`, and `autoIndexCalendarEvent`
- returns a summary object

- [ ] **Step 2: Run Convex dev to verify code generation succeeds**

Run: `bunx convex dev`
Expected: `Convex functions ready!`

- [ ] **Step 3: Keep seed content clearly tagged**

Use stable titles/tags such as `dev-seed`, `onboarding`, and `release` so the mutation can skip duplicates and so assistant queries have predictable overlap.

### Task 2: Verify Seeded Data Works For Assistant Testing

**Files:**
- No code changes required

- [ ] **Step 1: Run the mutation once**

Run: `bunx convex run devSeed:seedWorkspace '{"workspaceId":"<workspaceId>"}'`
Expected: summary with created/skipped counts

- [ ] **Step 2: Check the workspace UI**

Open the workspace and confirm channels, messages, notes, tasks, and cards are visible.

- [ ] **Step 3: Test assistant and source citations**

Ask questions such as:
- `what are my tasks?`
- `what notes mention onboarding?`
- `what happened in general?`
- `what is blocked for release?`

Expected: assistant answers from seeded data and renders source citations beneath replies.
