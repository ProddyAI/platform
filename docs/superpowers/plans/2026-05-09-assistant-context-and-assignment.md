# Assistant Context And Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add active release/project memory to the assistant profile flow and make assistant task drafts capable of assigning work to accepted workspace members.

**Architecture:** Extend the existing assistant profile and pending task draft records rather than introducing a new subsystem. Keep member resolution and assignment permission checks inside the existing assistant conversation workflow so the behavior remains confirmation-first and merge-friendly.

**Tech Stack:** Convex, TypeScript, Bun tests

---

### Task 1: Add assistant profile context-memory tests

**Files:**
- Modify: `convex/assistant/profile.test.ts`
- Modify: `src/lib/assistant-orchestration.test.ts`

- [ ] **Step 1: Write the failing tests**
- [ ] **Step 2: Run the focused tests to verify they fail**
- [ ] **Step 3: Implement minimal profile/orchestration changes**
- [ ] **Step 4: Run the focused tests to verify they pass**

### Task 2: Add assignee-aware task-draft tests

**Files:**
- Modify: `convex/assistant/taskDrafts.test.ts`
- Modify: `convex/assistant/taskDrafts.ts`

- [ ] **Step 1: Write the failing assignee-format test**
- [ ] **Step 2: Run the focused test to verify it fails**
- [ ] **Step 3: Implement minimal formatting changes**
- [ ] **Step 4: Run the focused test to verify it passes**

### Task 3: Implement backend profile and assignment changes

**Files:**
- Modify: `convex/schema.ts`
- Modify: `convex/assistant/profile.ts`
- Modify: `convex/assistantProfiles.ts`
- Modify: `convex/assistantConversations.ts`
- Modify: `convex/assistantChat.ts`
- Modify: `convex/assistant/tools/internalTools.ts`

- [ ] **Step 1: Extend stored assistant profile and pending draft shapes**
- [ ] **Step 2: Add active-context extraction and prompt rendering**
- [ ] **Step 3: Add accepted-member resolution tool and assignee-aware draft handling**
- [ ] **Step 4: Add assignment permission checks for inviter/admin/owner paths**

### Task 4: Verify end-to-end focused behavior

**Files:**
- Verify only

- [ ] **Step 1: Run focused Bun tests for assistant profile, orchestration, and task draft helpers**
- [ ] **Step 2: Run a TypeScript check if the focused tests are green**
- [ ] **Step 3: Review the diff for accidental spillover into unrelated local edits**
