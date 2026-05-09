# Assistant Context And Assignment Design

## Goals

- Extend the assistant's "central context manager" role with lightweight structured memory for active releases and projects.
- Allow the assistant's task drafting flow to target another accepted workspace member instead of always assigning tasks to the current user.
- Keep changes backend-focused and low-risk for upcoming merges.

## Release / Project Context Memory

- Reuse the existing assistant profile record as the persistence layer.
- Add a compact `activeContexts` collection containing recent release/project entries.
- Each entry stores:
  - `kind`: `release` or `project`
  - `label`
  - `aliases` (optional)
  - `ownerHints` (optional)
  - `statusHint` (optional)
  - `lastMentionedAt`
- Extract context from explicit memory-like user messages such as "I'm working on the payment rollout" or "remember the onboarding redesign is blocked on copy".
- Render active contexts into the assistant system prompt so follow-up questions can reuse them.

## Member-Aware Task Assignment

- Keep the current `draft -> confirm -> create` workflow.
- Extend pending task drafts with optional assignee metadata.
- Add a workspace-member listing tool so the assistant can resolve an assignee before drafting.
- Only allow assignment to accepted workspace members.
- Preserve self-assignment behavior as the default when no assignee is specified.

## Permissions

- Self-assignment remains allowed for any workspace member.
- Cross-user assignment is allowed when:
  - the current member is an `owner` or `admin`, or
  - the current member invited the assignee to the workspace and that assignee has already joined.
- Pending invites are never valid assignee targets because no workspace member exists yet.

## Validation

- Add `bun:test` coverage for:
  - profile extraction and prompt rendering for active contexts
  - pending task draft confirmation formatting with assignee details
- Run focused tests after implementation.
