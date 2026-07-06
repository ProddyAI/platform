---
target: Calendar & Dashboard
total_score: 17
p0_count: 0
p1_count: 5
timestamp: 2026-07-06T14-48-44Z
slug: src-features-calendar
---
# Critique — Calendar & Dashboard

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/calendar, src/features/dashboard

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | ChatLoadingIndicator shows four static fake tags ('Calendar, Tasks, Search, Integrations') and 'Checking calendar, tasks...' regardless of what the assistant is actually doing (dashboard-chatbot.tsx:269-315); no streamin |
| 2 | Match system and real world | 1 | 'Clear' button actually starts a new chat (dashboard-chatbot.tsx:517-525); 'No filters applied' in calendar header means 'showing nothing', not 'unfiltered' (calendar-header.tsx:99-103); 'LIVE ENGINE' badge is jargon (st |
| 3 | User control and freedom | 2 | abort() exists but no Stop button is exposed while streaming — only New Chat aborts (dashboard-chatbot.tsx:1580); conversation delete is one click with no confirm (dashboard-chatbot.tsx:1634); widget removal recoverable  |
| 4 | Consistency and standards | 1 | Two empty-state designs across sibling widgets (mentions/team: rounded-md solid border-2 h-10 icon text-lg vs others: rounded-lg dashed border h-12 icon text-base); 'View All' vs 'View all'; widget headers font-medium vs |
| 5 | Error prevention | 1 | With zero event types selected the filter button reads 'Clear All' and sets [] again — a no-op that strands users on a blank calendar (calendar-filter.tsx:93-105); chat input is cleared before send with no restore on fai |
| 6 | Recognition over recall | 3 | @/# autocomplete, post-answer navigation chips, and source badges are strong; the filter trigger's unlabeled color dots (blue/purple/green) require recalling the color→type mapping until the dropdown is opened (calendar- |
| 7 | Flexibility and efficiency | 2 | Drag/resize/add customization is real, but KeyboardSensor is wired while the drag handle is an unfocusable div — no keyboard path (dashboard-widgets.tsx:200-207); chat input is a single-line Input with a dead Shift+Enter |
| 8 | Aesthetic and minimalist design | 1 | Triple-nested cards each with border-2 (page Card > WidgetCard > inner Card); red 10px timestamps shouting on every row; stress-widget hero-metric/gradient/uppercase slop; calendar preview renders 7 filler 'No events sch |
| 9 | Error recovery | 1 | Failures collapse to generic toasts ('Failed to update task — Please try again'); a failed chat send loses the typed prompt entirely; no retry affordances or inline error states anywhere in the module. |
| 10 | Help and documentation | 3 | Edit-mode instruction banner, teaching welcome message with example prompts, and empty states with next-action buttons (Create Task / Create Note / Create Canvas) are genuinely good; welcome copy ends in hype ('unlock mo |
| **Total** | | **17/40** | |

## Anti-Patterns Verdict

A user fluent in Linear or Notion would trust the skeleton — shadcn primitives, a familiar widget grid, a competent chat panel — but would pause at component after component. The Stress widget is textbook AI-slop: a `font-black tracking-tighter` hero metric ("87 / 150"), uppercase tracked eyebrow labels ("CURRENT LOAD", "DAILY FOCUS"), a meaningless "LIVE ENGINE" mono badge, a gradient card with `shadow-xl border-none`, and an infinitely pulsing alert — none of it in the register of the other eight widgets. Six widgets render every timestamp and future due date in destructive red. The calendar header hard-codes gray-on-white pill-in-pill chrome that dark mode un-breaks via `!important` class-name-sniffing CSS in globals.css, and dark mode alone gets pink glow-on-hover buttons with translateY lift that light mode never shows. The chat loading state fakes tool activity with four static labels. The mechanics underneath (real-time Convex prefs, @/# autocomplete, action chips) are genuinely good, but the surface fails the trust test: it reads as several generations of AI output pasted side by side rather than one system.

**Deterministic scan**: 1 findings — side-tab ×1.
Suspected false positives: 1 (src/features/dashboard/components/dashboard-chatbot.tsx:640 side-tab — the border-l-2 is a prose-blockquote: variant (conventional markdown blockquote left rule), not a side-tab card accent)

## Cognitive Load

- Single focus: FAIL — up to 9 co-equal widgets, each with count badges and red timestamps, no primary entry point; 'Workspace Overview' (dashboard-widgets.tsx:428) names the pile without directing attention to today's work.
- Chunking <=4: FAIL — the assistant welcome message is one block of ~10 bullets plus up to 8 example prompts (dashboard-chatbot.tsx:1423-1466); the Add Cards dialog lists all 9 widgets in one flat run (dashboard-widgets.tsx:552).
- Visual grouping: FAIL — three nested card layers each with border-2 (outer Card in dashboard-widgets.tsx:425 > WidgetCard border-2 > inner Card border-2 in team-status-widget.tsx:109 and calendar-preview-widget.tsx:94) blur which border means what; calendar preview adds 7 'No events scheduled' filler rows.
- Clear hierarchy: FAIL — 10px red timestamps outweigh 14px titles in every list row; widget titles vary font-medium / font-semibold text-base / font-bold text-lg so scan order differs per widget.
- <=4 visible options per decision point: PARTIAL FAIL — chat header offers New Chat / Recent Chats / Clear where Clear duplicates New Chat; Add dialog presents 9 ungrouped choices.
- No working-memory bridges: PARTIAL FAIL — filter trigger shows unlabeled blue/purple/green dots (calendar-filter.tsx:74-85) whose meaning is only defined inside the closed dropdown; count badges in the calendar filter bar rely on the same color mapping.
- One decision at a time: PASS — edit mode cleanly isolates layout decisions from content.
- Progressive disclosure: PASS — integration details behind a popover, widget controls only in edit mode.

## What's Working

- Real infrastructure under the UI: Convex-backed persisted widget layout (order/size/visibility), real-time queries throughout, dnd-kit with a KeyboardSensor already registered — the bones for an excellent dashboard exist.
- Empty states mostly teach the interface: Tasks/Notes/Canvas empty states include direct Create buttons that deep-link with ?action=create, matching the register's 'empty states that teach' rule.
- Chat mechanics are genuinely useful: @member/#channel autocomplete with proper token replacement and caret restoration, parsed source badges, post-answer navigation action chips, conversation history with inline rename.
- Edit mode is proper progressive disclosure — S/M/L, delete, and drag controls only appear in the mode, with a plain-language instruction banner.
- Add-widget dialog has correct multi-select interaction: selected-count feedback, disabled CTA at zero, selections reset on close, exhausted-state message.

## Priority Issues

### [P1] Calendar filter dead-end: deselecting all three event types blanks the calendar while the header says 'No filters applied' and the only recovery button reads 'Clear All' and is a no-op (sets eventTypes to [] when already empty).

**Why**: A user who toggles filters off is stranded on an empty calendar with copy that claims nothing is filtered and a button that does nothing — they must discover the three individual switches to recover. This blocks the core 'see my month' task until decoded.

**Fix**: In calendar-filter.tsx:96-104, when noTypesSelected show 'Select All' and set all three types; reserve 'Clear All' for allTypesSelected. Change the header copy at calendar-header.tsx:99-103 from 'No filters applied' to 'Nothing shown — all event types hidden' with an inline 'Show all' action.
**Files**: src/features/calendar/components/calendar-filter.tsx, src/features/calendar/components/calendar-header.tsx

### [P1] Destructive red is the default metadata color: mention age, thread-reply age, canvas/note updated-time, and all due dates (including future ones, 'in 3 days') render text-red-600 with a Clock icon across six widgets.

**Why**: Red must mean overdue/error. When every row on the dashboard carries red text, actual overdue items are invisible and the surface reads as permanently alarmed — the opposite of 'calm under load' in the brief.

**Fix**: Use text-muted-foreground for all timestamps; apply text-destructive (the token, not red-600) only when dueDate < now. Extract one shared <RelativeTime overdue?> component to replace the six copy-pasted spans, which also removes the duplicated .replace('about ', '') hack.
**Files**: src/features/dashboard/components/widgets/mentions-widget.tsx, src/features/dashboard/components/widgets/thread-replies-widget.tsx, src/features/dashboard/components/widgets/tasks-widget.tsx, src/features/dashboard/components/widgets/assigned-cards-widget.tsx, src/features/dashboard/components/widgets/notes-widget.tsx, src/features/dashboard/components/widgets/canvas-widget.tsx

### [P1] Widgets show false or silently-scoped data: Notes and Canvas widgets query only channels[0] while titled 'Recent Notes'/'Recent Canvases'; their 'View All' and Assigned Issues' 'View all' navigate to the first channel arbitrarily; Team Status 'Last seen X ago' is computed from member._creationTime (workspace join date), not activity.

**Why**: For operators who live in the app, a dashboard that quietly shows one channel's notes as 'recent notes' and reports a teammate 'last seen 8 months ago' (their join date) destroys trust in every other number on the screen.

**Fix**: Either query workspace-wide (aggregate across channels server-side) or retitle honestly ('Notes in #general'). Point 'View all' at a real index or hide it. In team-status-widget.tsx:63 drop the fabricated lastActive line entirely until real presence lastActive exists; also delete the dead statusEmoji field.
**Files**: src/features/dashboard/components/widgets/notes-widget.tsx, src/features/dashboard/components/widgets/canvas-widget.tsx, src/features/dashboard/components/widgets/assigned-cards-widget.tsx, src/features/dashboard/components/widgets/team-status-widget.tsx

### [P1] Assistant chat control gaps: no Stop button during streaming (abort only fires via New Chat); single-line <Input> with a dead Shift+Enter check so multi-line prompts are impossible; input cleared before send and not restored on failure; one-click unconfirmed conversation delete; a 'Clear' button with a trash icon that actually starts a new chat.

**Why**: This is the flagship AI surface. A power user mid-task cannot stop a wrong generation, cannot write a structured prompt, loses their text on network failure, and can destroy history with one misclick on a mislabeled control.

**Fix**: Swap Send for a Stop button while isLoading (abort is already available at dashboard-chatbot.tsx:1318-1324); replace Input with an auto-growing textarea honoring Shift+Enter; on send failure restore the prompt into the input; wrap delete in a confirm (AlertDialog); remove 'Clear' or rename it to what it does.
**Files**: src/features/dashboard/components/dashboard-chatbot.tsx

### [P1] Token discipline collapse in calendar chrome and dark mode: calendar-header/filter hard-code bg-white, gray-50/100/200/300/400/500 throughout, then globals.css patches dark mode with !important rules targeting utility-class selectors (.dark .calendar-month-pill, .dark [class*="bg-white"], .dark .calendar-filter-bar .text-xs.bg-gray-100) plus dark-only pink rgba(236,72,153,...) glow/translateY hover on .widget-button/.edit-mode-button/.chat-send-button.

**Why**: Light and dark are two different designs held together by fragile CSS-selector archaeology; any class rename silently breaks dark mode, and dark users get decorative glow motion light users never see — a direct violation of the 'one system' principle and the class-based token architecture already in place.

**Fix**: Replace every gray-*/white literal in calendar-header.tsx and calendar-filter.tsx with bg-card/bg-muted/border-border/text-muted-foreground tokens, use dark:text-primary-foreground-style token variants for the ~20 dark:text-purple-400 repetitions in widgets (or adjust --primary for dark), then delete the .calendar-*, .widget-button, .edit-mode-button and [class*="bg-white"] override blocks from globals.css.
**Files**: src/features/calendar/components/calendar-header.tsx, src/features/calendar/components/calendar-filter.tsx, src/app/globals.css

### [P2] Keyboard and screen-reader paths are broken at the edit layer: the drag handle is a plain div with {...listeners} but no tabIndex/role/aria-label so the registered KeyboardSensor is unreachable; S/M/L resize, X delete, and calendar chevron buttons have no accessible names; ChatHistoryItem edit/delete are opacity-0 group-hover:opacity-100 with no focus-within reveal; the month display is a div, not a heading.

**Why**: The brief says keyboard paths are non-negotiable. Today a keyboard user cannot reorder widgets at all, hears 'button S' from a screen reader, and can never see the rename/delete controls in chat history.

**Fix**: Make the drag handle a <button aria-label="Reorder widget" tabIndex={0}>; add aria-labels ('Small size', 'Remove widget', 'Previous month', 'Next month'); add focus-within:opacity-100 to the history-item action group; wrap the month text in an h1/h2.
**Files**: src/features/dashboard/components/dashboard-widgets.tsx, src/features/dashboard/components/dashboard-chatbot.tsx, src/features/calendar/components/calendar-header.tsx

### [P2] One dashboard, three visual dialects: the Stress widget breaks register (font-black hero metric, uppercase tracked kickers, 'LIVE ENGINE' badge, gradient bg, animate-pulse alert, rounded-xl); the other widgets split into two empty-state designs, two header weights, 'View All'/'View all', colored vs plain priority badges, spinners where the register mandates skeletons, and three different list heights.

**Why**: The register's rule is exact: 'if the save button looks different in two places, one is wrong.' Nine widgets on one screen with divergent vocabularies is what makes the surface read as generated rather than designed.

**Fix**: Extract a shared WidgetHeader (icon + title + count badge + action) and WidgetEmptyState (one style: dashed border, icon, title, body, optional CTA), standardize list height and 'View all' casing, restyle stress-widget with the standard header/tokens and delete the 'Live Engine' badge, gradient, and pulse (or gate pulse behind motion-safe).
**Files**: src/features/dashboard/components/widgets/stress-widget.tsx, src/features/dashboard/components/widgets/mentions-widget.tsx, src/features/dashboard/components/widgets/team-status-widget.tsx, src/features/dashboard/components/widgets/tasks-widget.tsx, src/features/dashboard/components/widgets/calendar-preview-widget.tsx, src/features/dashboard/components/shared/widget-card.tsx

## Persona Red Flags

- Alex (impatient power user): cannot write a multi-line prompt — ChatComposer uses a single-line <Input> and handleKeyDown's Shift+Enter branch is dead code (dashboard-chatbot.tsx:971, 1572); cannot stop a bad generation (no abort control in the UI); 'View all' on Notes/Canvas/Assigned Issues dumps him into channels[0] instead of an index (notes-widget.tsx:93, canvas-widget.tsx:140, assigned-cards-widget.tsx:103); every widget greets him with a centered spinner in a 300px void on each dashboard visit.
- Sam (screen reader / keyboard-only): the drag handle is a non-focusable div with {...listeners} (dashboard-widgets.tsx:200-207) so the registered KeyboardSensor can never fire — reordering is mouse-only; 'S'/'M'/'L' and the X delete button announce as single letters (dashboard-widgets.tsx:155-198); chat-history rename/delete are opacity-0 group-hover only with no focus reveal (dashboard-chatbot.tsx:574); calendar prev/next chevrons unlabeled and the month is a div, not a heading (calendar-header.tsx:50-69).
- Riley (stress-tester): toggling all three event-type switches off blanks the calendar while the header claims 'No filters applied' and the button offers a no-op 'Clear All' (calendar-filter.tsx:93-105); a long channel name in the mentions badge has no truncate/min-w-0 and shoves the timestamp out of the row (mentions-widget.tsx:206-219); a failed chat send eats the typed prompt because input is cleared before await (dashboard-chatbot.tsx:1545-1557); one stray click on the hover trash icon permanently deletes a conversation with no confirm (dashboard-chatbot.tsx:586-596).

## Minor Observations

- safeFormatDistanceToNow (mentions/threads) vs formatDistanceToNow(...).replace('about ', '') (tasks/cards/notes/canvas) — two hacks for the same job.
- DropdownMenuSeparator between every chat-history item is heavier than the standard list treatment.
- Sparkles icon marking AI-generated titles at 40% opacity (dashboard-chatbot.tsx:567) is un-explained iconography — needs a tooltip or removal.
- min-w-[160px] month pill will clip long localized month names.
- Chat user-bubble timestamp at opacity-70 on primary purple is borderline; verify 4.5:1.
- MessageBubble timestamp on every message adds noise — group by time like the messaging module.
- AVAILABLE_WIDGETS 'stress' description 'AI-driven workload analysis and daily focus session' is the only hype-toned description in the list.
- Edit-mode S/M/L on mobile: gridSizeClasses collapse to col-span-1 for all sizes, so resize buttons appear to do nothing on small screens.
- widget-scroll-area class only applied in mentions-widget — dead-ish CSS coupling.
- Toast copy 'Chat renamed successfully'/'Chat deleted successfully' — drop 'successfully' per brand voice.
- ChatLoadingIndicator Zap icon animate-pulse plus Loader spin in the same bubble — two competing motion signals.
- No motion-safe/reduced-motion guards anywhere in the module (pulse, hover-scale utilities, 1s meter fill).

## Per-Component Notes

- `src/features/dashboard/components/widgets/stress-widget.tsx` — Strip the slop layer: delete 'Live Engine' badge, replace text-3xl font-black hero readout and uppercase tracking-widest/tracking-tight kickers with the standard widget header scale, remove bg-gradient-to-br/shadow-xl/border-none from the card, gate or remove animate-pulse on the high alert, swap emerald/amber/rose literals for semantic tokens, and shorten the 1000ms meter transition.
- `src/features/calendar/components/calendar-header.tsx` — Tokenize everything (bg-white→bg-card, gray-*→muted/border tokens) and delete the matching .dark !important patches in globals.css; flatten pill-in-pill-in-bar nesting (three bordered boxes to say one month); make the month an h1 with aria-labeled chevrons; add a Today button; give search a clear affordance and either live filtering or a visible submit.
- `src/features/dashboard/components/dashboard-chatbot.tsx` — Replace Input with auto-growing textarea; add Stop-generation button; restore prompt on send failure; confirm conversation delete; remove or rename 'Clear' (it starts a new chat); replace the fake 'Checking calendar, tasks…' static tags with real tool status or a plain 'Thinking…'; drop 'unlock more capabilities!' hype from the welcome copy; kill the 1749-line single file by extracting the header/composer/history modules.
- `src/features/calendar/components/calendar-filter.tsx` — Fix Select All/Clear All inversion when nothing is selected (line 96-104); define event-type colors once as tokens shared with header count badges and trigger dots; add an accessible label to the dot cluster ('2 of 3 types shown').
- `src/features/dashboard/components/dashboard-widgets.tsx` — Drag handle → real button with aria-label; aria-labels on S/M/L/X; dialog CTA 'Done' → 'Add N cards'; unify 'card' vs 'widget' terminology (title says Cards, empty state says widgets); replace ✕ glyph in the instruction banner with plain words; consider skeletons for the initial widgets-loading state.
- `src/features/dashboard/components/widgets/team-status-widget.tsx` — 'Last seen' from member._creationTime is fabricated — remove until real activity data exists; statusEmoji is always ''; raw status string under the name duplicates the presence dot; uses bare Card instead of shared WidgetCard; Message button is the only ghost-left-aligned action in the module — align with the standard footer button.
- `src/features/dashboard/components/widgets/notes-widget.tsx` — First-channel-only scope must be labeled or fixed; extract the 50-line inline Quill-delta preview IIFE into a shared getPlainTextPreview helper (mentions/threads duplicate it); timestamp red → muted.
- `src/features/dashboard/components/widgets/canvas-widget.tsx` — Same first-channel scope lie; scanning 100 messages client-side to find canvases will miss older canvases silently — needs a dedicated query; static description 'Collaborative whiteboard canvas' on every row is filler, drop it.
- `src/features/dashboard/components/widgets/mentions-widget.tsx` — Red timestamp → muted; add min-w-0/truncate to the name+badge row; 'Mark all as read' is the only primary-variant header action across widgets — demote to ghost for consistency; unify empty state with the dashed-border variant; ScrollArea uses p-4 while siblings use pr-4.
- `src/features/dashboard/components/widgets/tasks-widget.tsx` — Priority chips (bg-blue-100/yellow-100/red-100) have no dark variants and bypass tokens; due date red only when overdue; completion toast 'Great job!' is celebration filler; 'View all' casing differs from siblings' 'View All'; metadata stacks 3 rows tall per task — inline priority + category + due on one row.
- `src/features/dashboard/components/widgets/thread-replies-widget.tsx` — Red timestamp → muted; 'Replied to your thread:' label plus preview box duplicates what the card already implies — tighten; text-[10px] metadata is below legible floor, use text-xs; share the preview helper.
- `src/features/dashboard/components/widgets/calendar-preview-widget.tsx` — Collapse empty days into a single 'Nothing else this week' line instead of 7 filler rows; `today` is re-created every render defeating both useMemos; EventCard uses bare Card + h5 (skips heading levels); event title can be undefined and renders an empty heading.
- `src/features/dashboard/components/widgets/assigned-cards-widget.tsx` — 'View all' routes to channels[0] board arbitrarily — wrong board most of the time; red future due dates; title 'Assigned Issues' vs add-dialog description 'Issues assigned to you' vs empty state 'No assigned cards' — pick 'issues' or 'cards'.
- `src/features/dashboard/components/shared/widget-card.tsx` — border-2 default makes every list heavy — use border with a hover:border-primary/30 state; onClick renders a clickable Card with no role/tabIndex/keyboard handler — either add button semantics or remove the prop.
- `src/app/globals.css` — (Supporting file) Delete the .dark widget-button/edit-mode-button/chat-send-button pink rgba glow blocks and .dark .calendar-* !important patches once components are tokenized; .widget-scroll-area hard-codes a 250px height in CSS while siblings use inline h-[280px] — one source of truth.

## Questions to Consider

- Is the Stress & Focus widget an intentional experiment or shipped surface? Its visual register diverges so hard from the other eight widgets that it needs either a redesign to the system or a flag.
- Is there (or should there be) a workspace-level notes/canvas index route? Every 'View all' currently has nowhere honest to point.
- What is the intended zero-filter semantic on the calendar — show everything or nothing? The copy, the button, and the render currently disagree three ways.
- Does presence data expose a real lastActive timestamp that Team Status could use instead of member join time?
