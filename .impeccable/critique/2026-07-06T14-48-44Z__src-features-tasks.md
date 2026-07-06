---
target: Planning (tasks, sprints, roadmap, projects)
total_score: 20
p0_count: 0
p1_count: 3
timestamp: 2026-07-06T14-48-44Z
slug: src-features-tasks
---
# Critique — Planning (tasks, sprints, roadmap, projects)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/tasks, src/features/sprints, src/features/roadmap, src/features/projects

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Cards flash their empty-state copy while stats load: sprint-card.tsx:222-226 shows 'No issues added yet' and milestone-card.tsx:224-226 shows 'No issues linked' whenever `stats` is still undefined; tasks page uses a cent |
| 2 | Match system and real world | 2 | Roadmap 'timeline' view (GanttChartSquare icon, roadmap-panel.tsx:73-79) is just a vertical card list with dots — no time axis, no date ordering guarantee; module vocabulary splits between 'tasks' (tasks feature) and 'is |
| 3 | User control and freedom | 1 | No confirm or undo on deleting sprints/milestones/tasks; sprint/milestone detail selection is component state only (sprints-panel.tsx:38, roadmap-panel.tsx:40) so refresh loses place and Back exits the page; connect-proj |
| 4 | Consistency and standards | 1 | Two design systems in one module group (tokens vs hard-coded grays); status color semantics swapped between siblings — sprint active=emerald/completed=blue (sprint-card.tsx:38-47) vs milestone in_progress=blue/completed= |
| 5 | Error prevention | 2 | Sprint end<start caught only at submit via toast (create-sprint-modal.tsx:54-57) instead of inline min= on the date input; no min on milestone target date; destructive deletes one click away in dropdowns with zero guard |
| 6 | Recognition over recall | 3 | Count pills in sprints/roadmap headers look like filter chips but are inert — the actual filter is a separate Select on the same row (sprints-panel.tsx:100-133, roadmap-panel.tsx:97-130) |
| 7 | Flexibility and efficiency | 2 | No keyboard shortcuts, no bulk operations, no quick-add row; 'Roll over incomplete' picks the destination sprint for you (sprints-panel.tsx:51-72) — power users can't choose the target |
| 8 | Aesthetic and minimalist design | 2 | Tasks module: oversized rounded-xl p-5/p-6 cards, decorative bg-white/10 hover sheen on the create CTA (task-create-form.tsx:153), rounded-full pill buttons — against the module's own denser sprint/roadmap idiom |
| 9 | Error recovery | 1 | task-edit-form.tsx:80-81 swallows save failures with console.error only — the user gets no toast, no inline error, the form just stays open; task-category-selector.tsx:90-92 same pattern; all other errors are generic 'Fa |
| 10 | Help and documentation | 3 | DialogDescriptions and empty states genuinely teach ('Projects own boards…', 'Use "Add issues" to pull work from the board') — best-in-module copy; nothing deeper for classify()-driven stats which can surprise users with |
| **Total** | | **20/40** | |

## Anti-Patterns Verdict

Split verdict. The sprints/roadmap/projects half would largely pass the trust test for a Linear-fluent user: token-driven shadcn vocabulary, centralized status-badge configs, skeleton loading, teaching empty states, plain-spoken dialog copy. The tasks half is a visibly older, different product — hard-coded gray-*/white palettes with `.dark [class*="bg-white"]` global hacks, a loud pink py-6 CTA with a decorative hover sheen overlay, dead Tailwind classes (`hover:bg-secondary-600`, `hover:bg-red-150`), a template-string-built class that JIT can never compile, Title Case labels, spinner-in-content loading, and an entire unused duplicate filter component. None of the classic AI-slop tells (no gradient text, no hero metrics, no 01/02/03 scaffolding), but the seam between Tasks and the rest of the planning group is exactly the "strangeness without purpose" the register bans: the same user creates a sprint in one grammar and a task in another, and pauses at every subtly-off component in the latter.

**Deterministic scan**: 2 findings — gray-on-color ×2.
Suspected false positives: 1 (src/features/tasks/components/task-item.tsx:200 (both findings): bg-red-100 is hover-only and is paired with hover:text-red-600 / dark:hover:text-red-400 — gray text only appears on bg-gray-50/gray-800, never on the red background; detector matched classes across variant states)

## Cognitive Load

- Single focus (FAIL): the Tasks page permanently stacks a full 'Create a new task' section above the list — collapsed state is still a giant pink py-6 CTA competing with the actual task list (task-create-form.tsx:133-161 as consumed by tasks/page.tsx:224-232)
- Chunking <=4 (FAIL): task-sidebar.tsx has five collapsible sections (Priority, Due Date, Categories, Sort By, Sort Direction); Sort By and Sort Direction are one decision split into two chunks
- <=4 visible options per decision point (FAIL): Due Date filter exposes 5 radio options (All/Overdue/Today/Upcoming/No due date) in both task-sidebar.tsx:190-270 and task-filter.tsx:184-220; sprint/milestone status Selects list 5 items
- No working-memory bridges (FAIL): 'Roll over incomplete' never shows the destination — sprints-panel.tsx:51-72 silently picks the first planning/active sprint, so the user must hold the sprint inventory in their head to predict the outcome
- Visual grouping (PARTIAL FAIL): count pills and the status filter Select share one toolbar row but only the Select filters; pills read as interactive filter chips and are inert (sprints-panel.tsx:100-133, roadmap-panel.tsx:97-130)

## What's Working

- Sprints/roadmap/projects components are properly token-disciplined: bg-card, text-muted-foreground, border tokens, semantic badge configs — one grammar with the shadcn layer (sprint-card.tsx, milestone-card.tsx, project-nav-tabs.tsx)
- Empty states teach the interface and carry the next action: 'Create your first sprint to start planning' + CTA (sprints-panel.tsx:144-167, roadmap-panel.tsx:141-166), 'Use "Link issues" to connect work to this milestone' (milestone-detail.tsx:150-158)
- Skeleton loading (not spinners) in all four panel/detail components, matched to content shape (h-36/h-40 card skeletons, h-12 row skeletons)
- Smart defaults reduce decisions: create-sprint-modal prefills name 'Sprint N' and a two-week date range; create form copy is confident and plain-spoken per brand voice
- Shared IssuePickerPopover reused identically across sprint and milestone details — same affordance for the same job
- Centralized SPRINT_STATUS_CONFIG / MILESTONE_STATUS_CONFIG exported and reused between card and detail views — single source of truth for state vocabulary
- Overdue signals are computed and layered sensibly (badge + colored countdown with 7-day warning threshold in milestone-card.tsx:191-208)

## Priority Issues

### [P1] The tasks feature and the sprints/roadmap/projects features are two different design systems in one planning module

**Why**: PRODUCT.md demands 'One system — every module speaks one grammar' and the register bans 'inconsistent component vocabulary across screens'. Tasks uses hard-coded bg-white/gray-50/gray-200/gray-700 with dark:bg-[hsl(var(--card))] escape hatches, pink bg-secondary CTAs, rounded-full icon buttons, Title Case labels, and spinner loading; sprints/roadmap uses bg-card/muted/border tokens, outline badges, skeletons, sentence case. A user moving between the Sprints tab and the Tasks page experiences two products.

**Fix**: Port the tasks components to the token vocabulary used by sprints/roadmap: replace every gray-*/bg-white literal with card/muted/border/muted-foreground tokens (deleting the dark: overrides they necessitate), swap the pink CTA for the standard default Button, use the shared Badge/status idiom for priority pills, and align all button/label casing to sentence case.
**Files**: src/features/tasks/components/task-create-form.tsx, src/features/tasks/components/task-edit-form.tsx, src/features/tasks/components/task-item.tsx, src/features/tasks/components/task-sidebar.tsx, src/features/tasks/components/task-toggle-view.tsx, src/features/tasks/components/task-filter.tsx

### [P1] Nested interactive elements and hover-only invisible controls break keyboard and screen-reader use

**Why**: sprint-card.tsx:95-182 and milestone-card.tsx:97-183 render the whole card as a <button> with a nested DropdownMenu <Button> inside — invalid HTML (button-in-button) with undefined SR/keyboard behavior. Worse, the menu trigger and the unlink X buttons (milestone-detail.tsx:206, sprint-detail.tsx:219) are opacity-0 group-hover:opacity-100 with no focus-visible override: a keyboard user tabs onto a control they cannot see. PRODUCT.md calls keyboard paths non-negotiable.

**Fix**: Make the card a <div> with an inner link/button covering the title area (or role=link + onKeyDown), keeping the DropdownMenu a sibling in the DOM; add focus-visible:opacity-100 group-focus-within:opacity-100 to every opacity-0 group-hover:opacity-100 control.
**Files**: src/features/sprints/components/sprint-card.tsx, src/features/roadmap/components/milestone-card.tsx, src/features/roadmap/components/milestone-detail.tsx, src/features/sprints/components/sprint-detail.tsx

### [P1] Destructive deletes execute immediately with no confirmation and no undo

**Why**: 'Delete sprint' (sprint-card.tsx:175-180), 'Delete milestone' (milestone-card.tsx:176-181) are single dropdown clicks adjacent to routine actions; the task Trash button (task-item.tsx:199-207) deletes on click. A sprint or milestone carries issue links and planning history — a slipped click destroys real work with only a success toast as receipt (Nielsen 3/5/9).

**Fix**: Gate delete behind an AlertDialog ('Delete Sprint 4? Its 12 issues stay on the board.') or make the success toast an undo toast backed by a soft-delete mutation. The repo already has convex/lib safe-delete helpers.
**Files**: src/features/sprints/components/sprint-card.tsx, src/features/roadmap/components/milestone-card.tsx, src/features/tasks/components/task-item.tsx

### [P2] Dead Tailwind classes and a runtime-built class string mean several hover/interaction states silently never render

**Why**: hover:bg-secondary-600 (task-create-form.tsx:146,304) references a shade that doesn't exist in tailwind.config.ts; hover:bg-red-150/amber-150/blue-150 (task-sidebar.tsx:128,144,160,209,225,241) aren't Tailwind shades; task-item.tsx:152-154 builds `hover:border-${getPriorityTextColor(priority).replace("text-", "")}/30` producing 'hover:border-red-700 dark:text-red-400/30' — dynamic class construction the JIT can never compile. The register requires the full default/hover/focus state set; these components ship with holes.

**Fix**: Replace with real utilities: hover:bg-secondary/90 for the CTA, hover:bg-red-100 (or /80) for the sidebar actives, and a static lookup map for priority hover borders (e.g. {high: 'hover:border-red-300', ...}).
**Files**: src/features/tasks/components/task-create-form.tsx, src/features/tasks/components/task-sidebar.tsx, src/features/tasks/components/task-item.tsx

### [P2] Failed task saves are silently swallowed

**Why**: task-edit-form.tsx:80-81 catches update errors and only console.errors — no toast, no inline message; the user clicks Save, nothing visibly happens, and they can't tell whether their edit persisted. task-category-selector.tsx:90-92 has the same pattern for category creation. Every sibling component in sprints/roadmap surfaces failures via toast.

**Fix**: Add toast.error('Couldn't save task changes') in the catch (matching the create form's pattern at task-create-form.tsx:86-89) and keep the form open with values intact; same for category creation.
**Files**: src/features/tasks/components/task-edit-form.tsx, src/features/tasks/components/task-category-selector.tsx

### [P2] Sprint/milestone detail views and filters live only in component state — no URL, no deep links, broken Back

**Why**: sprints-panel.tsx:38-44 and roadmap-panel.tsx:40-47 swap in the detail view via useState. For operators who live in the app all day, this means: refresh loses your sprint, you can't paste a link to 'Sprint 4' in chat (the product's whole pitch is conversation→execution), and browser Back unexpectedly leaves the module instead of the detail view.

**Fix**: Encode selection in the route or search params (/project/[id]/sprints?sprint=<id> via useSearchParams/router.replace), so detail views are addressable and Back works; do the same for the status filter.
**Files**: src/features/sprints/components/sprints-panel.tsx, src/features/roadmap/components/roadmap-panel.tsx

### [P2] Status color semantics are swapped between the adjacent Sprints and Roadmap tabs, and progress buckets are guessed from status-name substrings

**Why**: Sprint 'Active' is emerald and 'Completed' is blue (sprint-card.tsx:38-47); Milestone 'In Progress' is blue and 'Completed' is emerald (milestone-card.tsx:35-44) — one tab apart, 'currently happening' and 'done' trade colors. Meanwhile classify() (sprint-detail.tsx:30-39, milestone-detail.tsx:28-37, duplicated) buckets issues by keyword matching on status names: a custom 'Won't fix' column counts as 'to do' forever and quietly corrupts the progress stats users plan against.

**Fix**: Adopt one semantic mapping module-wide (in-flight=blue, done=emerald, as milestones have it) and apply it to both configs and the header count pills; replace client-side classify() with a status category field from the board status model (or at least centralize the shared helper and expose mismatches).
**Files**: src/features/sprints/components/sprint-card.tsx, src/features/roadmap/components/milestone-card.tsx, src/features/sprints/components/sprint-detail.tsx, src/features/roadmap/components/milestone-detail.tsx, src/features/sprints/components/sprints-panel.tsx

## Persona Red Flags

- Sam (screen-reader/keyboard): sprint-card.tsx and milestone-card.tsx announce as a single button containing another button (menu) — nested interactive content; tabbing reaches invisible opacity-0 controls (card menus, detail-row X buttons); create-milestone-modal.tsx:132 aria-label='Select color #6366f1' reads a raw hex to SR users while task-category-selector.tsx:36-47 correctly uses color names; issue status conveyed only by a 8px color dot + text-xs name (milestone-detail.tsx:195-202)
- Alex (impatient power user): cannot deep-link or share a sprint/milestone (state-only selection, sprints-panel.tsx:38); rollover chooses his target sprint for him; delete has no undo so a mis-click in the hover menu costs real planning data; on the Tasks page his save failure is silent (task-edit-form.tsx:80) so he retypes edits that may have persisted
- Riley (stress-tester): a board column named 'Won't fix' or 'Blocked' is bucketed as 'to do' by classify() keyword matching, permanently deflating sprint completion stats; a task due today at 00:00 shows a red 'overdue' pill by midday (task-item.tsx:270 uses `new Date(dueDate) < new Date()`) while the page's Overdue filter (startOfDay comparison, tasks/page.tsx:112-118) excludes it — the pill and the filter disagree; every sprint card fires its own stats query (useGetSprintStats per card), so 50 sprints = 50 subscriptions

## Minor Observations

- Roadmap 'timeline' view is a dotted vertical list, not a timeline — the GanttChartSquare icon over-promises (roadmap-panel.tsx:73-96, 177-196); either order by targetDate along a real axis or rename/re-icon the toggle
- text-secondary (hsl 326 100% 55% ≈ #FF1A9C, ~3.6:1 on white) is used for text-xs UI text — active filter states in task-sidebar.tsx and the count badge/active tab in task-toggle-view.tsx:51-77 — below the 4.5:1 requirement
- Double success toast on task creation: task-create-form.tsx:70-72 toasts, then onSuccess fires the page's second 'Task created successfully' toast (tasks/page.tsx:174-178)
- task-filter.tsx is an entire unused duplicate filter/search UI — only its TaskFilterOptions type is imported anywhere; delete the component or converge it with task-sidebar
- create-sprint-modal.tsx:28 toDateInput uses toISOString() (UTC), so users west of UTC get tomorrow's date as the default start in the evening; format with local date parts
- Commented-out heading leaves the close X floating top-LEFT of the create form (task-create-form.tsx:170-181) — restore the title or right-align the X
- connect-project-channel-modal.tsx:133-137 shows 'Loading project...' text instead of a skeleton; `open={state.open || isPending}` also blocks Escape during save
- create-project-modal.tsx footer has no Cancel button while its sibling connect modal has Cancel + Save — same form vocabulary, different exits
- milestone-card.tsx:105 4px top color stripe (h-1) skirts the banned >1px accent-stripe pattern; it carries the user-chosen milestone color so it's defensible, but a 2px stripe or a colored Flag icon alone would be quieter
- TaskToggleView empty state ('No active tasks', task-toggle-view.tsx:84-91) doesn't teach or offer an action, unlike the sprints/roadmap empty states
- Uppercase tracked micro-labels 'LINKED ISSUES'/'SPRINT GOAL' (milestone-detail.tsx:129, sprint-detail.tsx:101,143) are eyebrow-kicker styling; used sparingly here but worth one consistent section-label style
- globals.css `html { scroll-behavior: smooth }` and .animate-float/hover-scale utilities have no prefers-reduced-motion guards (module-adjacent, affects these surfaces)
- project-nav-tabs.tsx buttons lack aria-current and an explicit focus-visible ring; also the icon+label tab pattern deserves keyboard left/right arrow support eventually

## Per-Component Notes

- `src/features/tasks/components/task-create-form.tsx` — Retokenize (drop all gray-*/bg-white), fix dead hover:bg-secondary-600, remove decorative bg-white/10 hover sheen span, restore or remove the commented heading (X currently floats top-left), sentence-case 'Create Task'/'Set Priority', drop the duplicate success toast
- `src/features/tasks/components/task-item.tsx` — Replace the template-string hover:border-* class (152-154) with a static map; confirm-or-undo for delete; align overdue check with startOfDay; retokenize grays; add focus-within visibility for the hover-only edit/delete buttons
- `src/features/tasks/components/task-sidebar.tsx` — Fix 6 dead hover:bg-*-150 classes; merge Sort By + Sort Direction into one section; replace gray-* palette with tokens; text-secondary active state fails contrast — use a darker accent or add font-weight + background only
- `src/features/tasks/components/task-edit-form.tsx` — Surface save errors (toast) instead of console.error; add the Clear-date affordance the create form has; drop bg-white/border-secondary/30 for card/border tokens
- `src/features/sprints/components/sprint-card.tsx` — Un-nest the DropdownMenu from the card <button>; focus-visible:opacity-100 on the trigger; gate delete behind confirm; swap completed=blue to the milestone mapping; distinguish stats-loading from 'No issues added yet'
- `src/features/roadmap/components/milestone-card.tsx` — Same un-nesting + focus-visible + delete-confirm work as sprint-card; 'No issues linked' shows while stats load; consider thinning the 4px color stripe
- `src/features/sprints/components/sprints-panel.tsx` — Put selectedSprintId and filter in the URL; rollover should show/choose the destination sprint (a small dialog listing planning sprints); make count pills either filter on click or look inert
- `src/features/roadmap/components/roadmap-panel.tsx` — Rename or genuinely implement the timeline view (order by targetDate, show axis); URL-encode selection/filter/view; count pills same inert-chip issue
- `src/features/sprints/components/sprint-detail.tsx` — classify() keyword matching mislabels custom statuses — derive done/in-progress from status category, and dedupe the helper shared with milestone-detail; unlink X needs focus-visible visibility; add row-level keyboard affordance
- `src/features/roadmap/components/milestone-detail.tsx` — Duplicate classify() helper (identical to sprint-detail) — extract; hover-only unlink X invisible to keyboard; consider showing target-date countdown here as the card does
- `src/features/tasks/components/task-filter.tsx` — Dead component — nothing renders it; delete it or make it the single filter surface; if kept: use lucide Search instead of the inline SVG, sentence-case labels, remove never-offered status options from the type
- `src/features/tasks/components/task-toggle-view.tsx` — Segmented control is hand-built from ghost Buttons with bg-white hardcodes — use Tabs primitive; active count badge in text-secondary fails contrast; empty state should teach ('Completed tasks appear here…')
- `src/features/tasks/components/task-category-selector.tsx` — Toast on create failure (currently console-only); trigger Button has no explicit selected/cleared affordance for keyboard clearing; consider reusing the milestone color-swatch row style for one swatch vocabulary
- `src/features/sprints/components/create-sprint-modal.tsx` — Local-date default instead of toISOString (UTC off-by-one); inline end-date validation (min={startDate}) instead of submit-time toast; disable Cancel while isPending
- `src/features/roadmap/components/create-milestone-modal.tsx` — Give swatches human-readable aria-labels (names, not hex); add min on target date; hover:scale-110 on swatches is decorative motion — a ring on hover is quieter
- `src/features/projects/components/create-project-modal.tsx` — Add a Cancel button to match the connect modal; 'Connected channel' should be a Label bound to the trigger; consider showing why a project needs >=3 chars when the button is disabled
- `src/features/projects/components/connect-project-channel-modal.tsx` — Skeleton instead of 'Loading project...' text; don't hold the dialog open via open={state.open || isPending} — disable controls instead
- `src/features/projects/components/project-nav-tabs.tsx` — Cleanest file in the group; add aria-current='page' on the active tab and an explicit focus-visible ring

## Questions to Consider

- Is the tasks feature (personal to-dos) intentionally a separate concept from board issues, or are they meant to converge? The two-vocabulary split (tasks vs issues) and two visual languages suggest the module predates the sprints/roadmap work — knowing the roadmap for it changes whether P1 #1 is a port or a rewrite.
- Should the header count pills in sprints/roadmap act as filters on click? They read as filter chips; making them set the status filter would remove the redundant Select.
- Do board statuses have (or can they get) a semantic category field (todo/in-progress/done)? That would delete the fragile classify() keyword matching in both detail views.
