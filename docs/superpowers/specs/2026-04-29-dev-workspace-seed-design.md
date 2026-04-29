# Dev Workspace Seed Design

## Goal

Create a temporary one-off Convex seed for a personal development deployment that fills an empty workspace with enough realistic data to test assistant answers and source citations.

## Scope

- Seed one existing workspace chosen by `workspaceId`
- Add a small set of channels, messages, notes, tasks, board lists/cards, and one calendar event
- Trigger existing RAG indexing flows so assistant search and citations can use the seeded content
- Keep the implementation disposable so the seed file can be deleted after running once

## Approach

Add a temporary Convex mutation that accepts `workspaceId`, looks up the workspace owner/member, inserts realistic records directly into the existing tables, and schedules the repo's existing indexing actions for each seeded entity. The mutation will be idempotent enough for development by skipping creation when it detects prior seed markers/titles.

## Constraints

- No schema changes
- No permanent UI changes
- No reliance on the shared team deployment
- Safe to delete after the dev DB has been populated

## Seed Data

- `general` and `release-planning` channel context
- 4-6 messages around onboarding, release blockers, and sprint planning
- 2-3 notes with overlapping search terms
- 3-5 tasks with statuses, priorities, and due dates
- 1 small board with a couple of cards
- 1 calendar event connected to a seeded message

## Verification

- Run the seed once against the personal Convex dev deployment
- Confirm data appears in workspace UI
- Ask assistant questions about onboarding, release, tasks, notes, and messages
- Verify citations render beneath assistant replies
