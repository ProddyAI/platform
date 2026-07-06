---
target: Board (kanban + task dependency graph)
total_score: 19
p0_count: 1
p1_count: 3
timestamp: 2026-07-06T14-48-44Z
slug: src-features-board
---
# Critique — Board (kanban + task dependency graph)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/board

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Optimistic drag/reorder with rollback is strong, but the drawer has no dirty/saved indicator across its three different persistence models (blur-save title/desc, instant status/priority, button-only labels/assignees); lo |
| 2 | Match between system and real world | 2 | Issues/statuses vocabulary matches Linear, but Gantt shows a different dataset than Board while the same header counter relabels itself ('issues' counting cards, board-page-content.tsx:741); Gantt bars fabricate start da |
| 3 | User control and freedom | 1 | No undo anywhere: Analyze Blockers auto-applies AI dependency edges with no review step or revert; sub-issue delete (board-issue-drawer.tsx:516-523) and subtask delete fire instantly with no confirmation; closing the dra |
| 4 | Consistency and standards | 1 | Two priority scales in one module (urgent…no_priority vs lowest…highest), two edit surfaces (Sheet drawer vs Dialog modal), two tooltip systems side-by-side in one toolbar (native title on Search/Linkage, Radix Tooltip o |
| 5 | Error prevention | 2 | Delete-status modal states consequences plainly (good), but Add Status with empty name is a silent no-op (no disabled state, no message); time-tracking fires a mutation on every keystroke with Number('')→0 clobbering val |
| 6 | Recognition rather than recall | 2 | Status colors and priority icons carry recognition well across row/column/drawer, but the done-status naming rule is invisible until it errors; 'Add blocking issue…' is a bare Select of truncated titles with no search or |
| 7 | Flexibility and efficiency of use | 3 | Inline create with Enter/Esc + hint line, drag-and-drop for issues and columns, ⌘K search delegation, +15m/+30m/+1h quick-adds are genuinely operator-friendly; but the Search button synthesizes a ctrlKey-only KeyboardEve |
| 8 | Aesthetic and minimalist design | 2 | The kanban row and column chrome are tight and quiet, but columns are w-[calc(25vw-1.5rem)] (≈94px on a phone, ≈450px on ultrawide — board-kanban-view.tsx:356), the wand emoji and StatusStats decorative dot add noise, an |
| 9 | Help users recognize, diagnose, and recover from errors | 2 | Page-level mutations rollback + toast correctly (handleDeleteStatus, handleMoveIssueStatus, reorder persist), but a whole tier fails silently to the user: create issue in column, add/remove blocker card, watcher toggle,  |
| 10 | Help and documentation | 2 | Toolbar tooltips and the 'Enter to save · Esc to cancel' hint are good in-place help; but Analyze Blockers' behavior (auto-applies edges) is undocumented beyond one tooltip line, the Gantt read-only note is buried inside |
| **Total** | | **19/40** | |

## Anti-Patterns Verdict

A Linear-fluent operator would trust the kanban surface at first sit-down — the issue row grammar (priority glyph, status dot, mono ID, truncated title, label chips, avatar stack) is genuinely category-correct, dense, and restrained, and the optimistic drag with rollback feels fast. Trust erodes within minutes of leaving the happy path: the Gantt tab silently swaps to a deprecated dataset and fabricates 3-day bars, the toolbar ships an 'Analyze Blockers 🪄' wand emoji that auto-applies AI edges with no review or undo, two incompatible priority scales coexist, delete is a modal in one place and a click-twice timer in another, Title Case and sentence case fight across buttons, and ~7 of 16 files are unreachable legacy UI in a second visual dialect. This is one excellent screen stapled to an abandoned product — the core reads hand-tuned, the periphery reads unsupervised generation left in the tree.

**Deterministic scan**: 3 findings — side-tab ×3.

## Cognitive Load

- Single focus — FAIL: board-issue-drawer.tsx renders title, description, 7 property rows, Sub-Issues, Blocking, Blocked By, and Discussion all expanded and all querying on open; no section is collapsible, so the user scans ~5 competing regions to do one edit.
- Chunking <=4 — FAIL: board-header.tsx presents 7 controls (search, linkage, analyze, connect, add status, 2-segment view switcher) as one flat cluster with no separators or grouping.
- One decision at a time — FAIL: BlockingSection (board-issue-drawer.tsx:981-1044) shows two near-identical selects ('Add blocking issue...' vs 'Add blocked by issue...') stacked with mirrored Shield icons; the direction of the relationship is a single preposition apart and easy to invert.
- No working-memory bridges — FAIL: sub-issue completion silently requires a status named exactly done/completed/complete/closed/resolved (DONE_STATUS_KEYWORDS, board-issue-drawer.tsx:130-141) — the rule lives nowhere in the UI and errors only at click time; delete-issue requires remembering an invisible 3-second confirmation window.
- Progressive disclosure — FAIL: nothing in the drawer or the (dead) edit-card modal defers content; comments, sub-issues, and both blocking lists fetch and render eagerly on every open.
- <=4 visible options per decision point — PARTIAL FAIL: the drawer's blocking area exposes 6 interactive elements for what is one decision (link two issues); toolbar exceeds 4 as noted.
- Visual grouping — PARTIAL: kanban columns and rows group well; the toolbar and drawer sections rely on Separators at opacity-40 that barely register.
- Clear hierarchy — PASS in kanban and drawer top half (22px title → 14px body → 11px meta is a sane product scale).

## What's Working

- Issue row anatomy (board-issue-row.tsx) is Linear-grade: priority glyph set (Flame/ArrowUp/ArrowRight/ArrowDown/Circle), status dot with ring-inset, mono short ID, truncating title, sub-issue progress line, label overflow (+N), avatar stack with dashed-circle unassigned state — dense and legible.
- Optimistic update discipline in board-page-content.tsx is real engineering: move/reorder/delete all snapshot previous state, apply immediately, roll back on error with toast, and deliberately let Convex reactivity reconcile to avoid the sync jump (lines 66-87, 363-390, 442-540).
- Inline issue creation in the column (input with Enter/Esc keyboard hints, blur-to-save, auto-focus) matches operator speed and the register's inline-over-modal preference.
- Status color is carried as one system through column header dot, row dot, drawer breadcrumb, and select items — recognition works.
- Delete-status modal copy is brand-correct: 'Delete "X" and all its issues? This cannot be undone.' — plain, verb-first, no hedging.
- Drop-target affordances (dashed 'Drop here' zone, drag overlays for both issue and status) convey state without decoration, and disableIssueDrag correctly guards drag while a search filter reorders reality.

## Priority Issues

### [P0] Gantt view renders the deprecated lists/cards dataset while Board renders issues/statuses — switching tabs silently swaps the underlying data. For any board on the current issue model, Gantt shows nothing (or stale legacy cards), the header counter relabels allCards.length as 'issues' (board-page-content.tsx:741), and bars fabricate a 3-day duration from dueDate (board-gantt-view.tsx:122-123).

**Why**: A user planning a sprint trusts a timeline; this one lies twice — wrong dataset and invented start dates. It breaks the product's core promise of one coherent surface.

**Fix**: Port BoardGanttView to consume issues (title/status/dueDate) or remove the Gantt tab until it does; render bars only for real date ranges (single-day marker when only a due date exists) and keep one totalIssues source for the header in both views.
**Files**: src/features/board/components/board-gantt-view.tsx, src/features/board/components/board-page-content.tsx

### [P1] Roughly 7 of 16 files are unreachable UI in a second design language: board-card.tsx is imported nowhere, and addCardOpen/editCardOpen/deleteListOpen are never set truthy, so BoardAddCardModal, BoardEditCardModal, and the six lazy panels they gate (subtasks, comments, time tracking, watchers, activity, card-blocking) can never open — yet they keep alive a conflicting lowest→highest priority scale, banned border-l-4 priority side-stripes, and a divergent modal vocabulary.

**Why**: Dead UI is where slop leaks in: it doubles the component vocabulary the team must keep consistent, ships six lazy chunks that can never load usefully, and any future contributor wiring 'edit card' resurrects the wrong pattern.

**Fix**: Delete board-card.tsx, both card modals, and the legacy state/mutations/handlers in board-page-content.tsx (also _uniqueIssueLabels, _moveCard, _handleDeleteCard); fold anything worth keeping (time tracking, watchers, activity) into the issue drawer with the issue priority scale.
**Files**: src/features/board/components/board-card.tsx, src/features/board/components/board-card-edit-dialog.tsx, src/features/board/components/board-page-content.tsx, src/features/board/components/board-subtask-list.tsx, src/features/board/components/board-card-comments.tsx, src/features/board/components/board-card-time-tracking.tsx, src/features/board/components/board-card-watchers.tsx, src/features/board/components/board-card-activity.tsx, src/features/board/components/board-card-blocking.tsx

### [P1] The issue drawer mixes four persistence models in one form: title/description save on blur, status/priority save instantly with rollback, due date saves via setTimeout(onBlur,100) racing setState, and labels/assignees save only via the footer 'Save changes' button — closing the drawer after editing labels or assignees silently discards them.

**Why**: Silent data loss for a competent operator who edits labels and hits Escape. There is no dirty indicator, so the user cannot know which fields are committed.

**Fix**: Pick one model — auto-save every field on change with the same rollback pattern used for status/priority — delete the footer Save button, and show a transient 'Saved' affordance; drop the setTimeout race by saving from the new value, not stale state.
**Files**: src/features/board/components/board-issue-drawer.tsx

### [P1] Keyboard and screen-reader paths are broken on the core surface: each issue row is a <button> that is also the dnd-kit sortable activator, so Enter/Space (KeyboardSensor defaults) contest between starting a drag and opening the issue; sub-issue check/delete, comment delete, and subtask delete are opacity-0 until pointer hover with no focus-within reveal; SheetContent renders with showCloseButton={false} and no SheetTitle, so the drawer dialog has no accessible name; column drag handles are listener-only divs with no keyboard alternative.

**Why**: PRODUCT.md declares keyboard paths non-negotiable; today a keyboard-only user cannot reliably open an issue, cannot see row actions, and hears an unnamed dialog.

**Fix**: Give rows a separate drag handle (keep row Enter/click = open), add focus-within:opacity-100 alongside group-hover on all revealed actions, add a visually-hidden SheetTitle ('Issue {id}: {title}'), and add an explicit focus-visible ring to the raw row button.
**Files**: src/features/board/components/board-issue-row.tsx, src/features/board/components/board-issue-drawer.tsx, src/features/board/components/board-kanban-view.tsx, src/features/board/components/board-status-column.tsx

### [P2] Contrast failures cluster in Gantt and micro-text: white text-xs font-semibold on #f97316 (~2.8:1), #60a5fa (~2.5:1), and secondary pink bars; drawer metadata at text-[11px] text-muted-foreground/50 and issue IDs at text-[10px] muted-foreground/60 land far below 4.5:1; 'Drop here' is text-primary/60 on primary/5.

**Why**: These are the exact places users read under pressure — timeline bars, IDs, timestamps. All fail WCAG AA, violating the brief's 'accessible by default'.

**Fix**: Use dark text on light bars (or a contrast-computed foreground per bar color), lift metadata to plain muted-foreground at minimum 11px, and use full-strength primary for the drop hint text.
**Files**: src/features/board/components/board-gantt-view.tsx, src/features/board/components/board-issue-drawer.tsx, src/features/board/components/board-issue-row.tsx, src/features/board/components/board-status-column.tsx

### [P2] Register/copy violations: 'Analyze Blockers 🪄' emoji dresses AI as magic (explicit PRODUCT.md anti-reference) and the feature auto-applies dependencies with only 'Analyze blockers: applied 3 dependencies' as feedback; Title Case ('Add Status', 'Add Sub-Issue', 'Add Subtask') mixes with sentence case ('Add issue', 'Save changes'); 'Start the discussion!' / 'Be the first to comment!' exclamations; delete-issue uses a nonstandard click-twice-in-3s pattern while every other destructive action uses a modal.

**Why**: Voice drift is how a suite stops feeling like one tool; the wand emoji specifically contradicts 'AI is a fast, reliable colleague — not a wizard'.

**Fix**: Rename to 'Detect blockers', drop the emoji, show detected edges for confirm-or-dismiss (or offer Undo in the toast); standardize sentence case; replace click-twice delete with the existing confirm-modal vocabulary; strike the exclamation marks.
**Files**: src/features/board/components/board-header.tsx, src/features/board/components/board-page-content.tsx, src/features/board/components/board-issue-drawer.tsx, src/features/board/components/board-card-comments.tsx

### [P2] Layout and token discipline: columns sized w-[calc(25vw-1.5rem)] instead of a fixed width (unusable ~94px columns on mobile, bloated on ultrawide); hover:bg-white/15 on Search/Linkage buttons is invisible in light mode; pervasive dark:bg-gray-950/900/800/700 literals bypass the theme tokens the app defines; the fake Ctrl+K KeyboardEvent is a brittle stand-in for calling the search store directly.

**Why**: Structural responsiveness and one token system are register requirements; the vw columns alone make the board fail on any narrow viewport Casey opens.

**Fix**: Fix columns at ~300px (w-[300px] or a clamp with sane min/max), replace white/15 hovers with hover:bg-muted, migrate dark: gray literals to bg-background/card/border tokens, and expose an openSearch() action instead of dispatching synthetic key events.
**Files**: src/features/board/components/board-kanban-view.tsx, src/features/board/components/board-header.tsx, src/features/board/components/board-page-content.tsx, src/features/board/components/board-status-column.tsx

## Persona Red Flags

- Alex (impatient power user): the Search button fabricates a ctrlKey KeyboardEvent (board-page-content.tsx:700-706) — if the global palette listens for metaKey on macOS the button does nothing; there is no 'C'-style create shortcut; the drawer forces him to guess which fields need the 'Save changes' click; 'Analyze Blockers 🪄' mutates his dependency graph with no review or undo — he will not run it twice.
- Sam (screen-reader/keyboard-only): pressing Enter on an issue row starts a dnd-kit keyboard drag instead of opening it (board-issue-row.tsx:358-376 — the row is both sortable activator and click target); sub-issue complete/delete buttons, comment delete, and subtask delete are opacity-0 group-hover only, invisible to focus; the issue Sheet has no SheetTitle so the dialog announces nothing; column reordering has no keyboard path (listener div, board-status-column.tsx:163-171).
- Riley (stress-tester): 'Add blocking issue...' Select enumerates every top-level issue title with no search, no IDs, truncated at w-44 — unusable at 80 issues (board-issue-drawer.tsx:996-1007); time-tracking fires a Convex mutation per keystroke and typing '12.5' persists 1, 12, 12., 12.5 (board-card-time-tracking.tsx:76); naming the done column 'Shipped' breaks every sub-issue checkbox with 'No completed status configured'; a 40-char unbroken label chip has no max-width and distorts rows; on a 375px viewport each kanban column is ~94px wide.

## Minor Observations

- formatIssueId uses the last 5 chars of the Convex ID (#K3J9X) — random, non-sequential, weak for recall and verbal reference; also duplicated in both drawer header and footer.
- StatusStats renders a decorative bg-primary/60 dot before the status count — accent color as decoration, contra the register.
- Status color presets default to #5e6ad2 — Linear's brand indigo — an odd tell.
- Badge label chips have no max-width; one long label pushes the due date and avatars off-balance in rows.
- Gantt header copy 'Showing N tasks with due dates across M lists' uses legacy 'lists' vocabulary on an issues product.
- board-issue-row hides labels and due dates below sm: breakpoint — acceptable, but nothing indicates metadata exists on mobile.
- Ellipsis placeholders ('Issue title...', 'Add label...', 'Search cards...') should use the … character per typographic polish.
- prefers-reduced-motion is never consulted; all transitions are short (ok) but the global smooth-scroll + drawer scrollIntoView combo ignores it.
- The 'Click again to confirm' text appearing in the drawer header causes a small layout shift of the action cluster.

## Per-Component Notes

- `src/features/board/components/board-page-content.tsx` — Strip dead legacy layer (addCardOpen/editCardOpen/deleteListOpen never set truthy; _uniqueIssueLabels/_moveCard/_handleDeleteCard unused); replace synthetic Ctrl+K event with a direct search-store action; give the boardLimitReached banner the amber/warning treatment instead of red error styling for a plan-limit notice; style the bare 'No channel selected.' fallback.
- `src/features/board/components/board-gantt-view.tsx` — Port to issues or remove; stop fabricating start dates; fix white-on-orange/blue bar contrast; kill the `.replace("bg-","bg-")` no-op class hack in the priority pill; replace fixed top-[60px] details panel with the shared Sheet; drop styled-jsx custom scrollbars and the uppercase tracked 'Task Details' eyebrow; migrate bg-white/dark:bg-gray-900 to tokens (the global .dark [class*=bg-white] !important hack currently fights this file).
- `src/features/board/components/board-issue-drawer.tsx` — Add visually-hidden SheetTitle; unify persistence + dirty state; fix setTimeout(onBlur,100) due-date race by saving the new value directly; DiscussionSection's scrollIntoView on mount (line 1063-1065) yanks the freshly opened drawer down to the comments — remove it; add focus-within reveal to hover-only actions; confirm sub-issue delete; auto-resize the title textarea instead of rows={title.length > 55 ? 2 : 1}; replace both blocking Selects with a searchable combobox showing IDs; hard-coded #cbd5e1/#00b341 in the sub-issue checkbox should be tokens.
- `src/features/board/components/board-issue-row.tsx` — Separate drag activator from the open-issue click/Enter target; add focus-visible ring to the raw button; the three unlabeled dots (status, blocked-by red, blocking dark) are indistinguishable without hover — consider a small lock/blocked glyph for blocked-by; align blocked-by/blocking colors with the drawer's orange/blue semantics (currently red/foreground here, orange/blue there).
- `src/features/board/components/board-card-edit-dialog.tsx` — Delete the dead Add/Edit card modals or rewire them; if kept: unify priority scale with issues, put the primary action rightmost in every DialogFooter (currently Add/Save/Delete render left of Cancel), replace 'Loading...' Suspense fallbacks with skeletons, and give Add Status a disabled state on empty name instead of a silent no-op.
- `src/features/board/components/board-header.tsx` — Remove 🪄; rename to 'Detect blockers'; hover:bg-white/15 on Search/Linkage is invisible on light bg — use hover:bg-muted; pick one tooltip system (Radix) for all five buttons; sentence-case 'Add status'; the connected-state green Link2 icon needs a non-color signal (e.g. check overlay) for color-blind users.
- `src/features/board/components/board-status-column.tsx` — Create-issue failure is console-only while the input closes — keep the input open and toast; the disabled add button's explanatory title never fires (disabled:pointer-events-none) — wrap in Tooltip on a span; give the drag handle aria-label and keyboard path; ring-black/10 on the status dot is invisible in dark mode (use ring-white/10 dark variant).
- `src/features/board/components/board-kanban-view.tsx` — Fix column width to ~300px instead of 25vw; replace 'Loading board…' with column skeletons; add an inline 'Add status' button to the empty state instead of pointing users to the header; the 50ms setTimeout before clearing the drag overlay is a magic-number band-aid — clear on optimistic state application.
- `src/features/board/components/board-card-time-tracking.tsx` — Debounce or save-on-blur instead of a mutation per keystroke; guard Number('')→0 and typed negatives (min attr doesn't validate onChange); local state never resyncs if the server rejects — reconcile from props.
- `src/features/board/components/board-linkage-diagram.tsx` — mermaid theme 'neutral' won't follow dark mode inside a themed dialog — pick theme by document class; add zoom/pan or at least min-width scroll for large graphs; skeleton over 'Rendering diagram…' text; empty state ('No issues in this board yet.') should say what the diagram is for.
- `src/features/board/components/board-card.tsx` — Orphaned component — delete. If it ever returns: border-l-4 priority side-stripes are a banned pattern, overdue check flags due-today as overdue, and its icon/color language contradicts board-issue-row.
- `src/features/board/components/board-card-blocking.tsx` — add/remove blocker failures are console-only — toast them; the popover search pattern here is exactly what the drawer's blocking Selects should be (one good pattern exists, use it there).
- `src/features/board/components/board-subtask-list.tsx` — Delete button is hover-only (add focus-within) and unconfirmed; empty-state copy is good teaching but Title Case 'Add Subtask' should be sentence case.
- `src/features/board/components/board-card-watchers.tsx` — Watcher toggle failures silent; the popover lists other watchers but only self is removable with no explanation — say 'Only you can change your watch state' or allow admin removal.
- `src/features/board/components/board-card-comments.tsx` — 'Be the first to comment!' violates the no-exclamation voice; comment add failure is silent; no delete-own-comment here while the drawer's DiscussionSection has one — inconsistent.
- `src/features/board/components/board-card-activity.tsx` — Runtime type-guard with an explicit invalid-data error state is genuinely good; hard-coded text-green-600/blue-600/purple-600 icon colors should map to semantic tokens; 'Loading activity...' → skeleton rows.

## Questions to Consider

- Is the lists/cards model officially deprecated? The answer decides whether Gantt gets ported to issues or removed, and whether the eight legacy files get deleted outright.
- Does the global ⌘K handler listen for ctrlKey, metaKey, or both on macOS — i.e., does the board's Search button currently work for Mac users at all?
- Is a sequential per-board issue key (BOARD-42) feasible in the schema, or is the random ID suffix a deliberate constraint?
- Is 'Analyze Blockers' intended to auto-apply edges without review, or was a confirm step planned? The blockedByIssuesDetailed reasoning/resolutionSteps payload suggests a review UI was intended.
