---
target: Notes & AI (notes, ai-notemaker, smart)
total_score: 20
p0_count: 1
p1_count: 3
timestamp: 2026-07-06T14-48-45Z
slug: src-features-notes
---
# Critique — Notes & AI (notes, ai-notemaker, smart)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/notes, src/features/ai-notemaker, src/features/smart

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Good: save badge with aria-live (blocknote-editor.tsx:207), streaming indicator with cancel (ai-actions-toolbar.tsx:368), live message counts per period (ai-notemaker.tsx:452). Bad: suggestions.tsx silently swaps in cann |
| 2 | Match between system and real world | 2 | Raw enum leaks into toast: 'No messages found for the selected period (since_last)' (ai-notemaker.tsx:176); '(Unmapped)' assignee jargon; 'professional MoM document'; 'Initialize Editor' (blocknote-editor.tsx:189); 'Erro |
| 3 | User control and freedom | 2 | Streaming is cancellable and AI inserts are one undo step (good), but 'Push to Tasks Dashboard' has no undo and no link to results; smart modals can't be dismissed by backdrop click; Cancel in period picker is a text-gra |
| 4 | Consistency and standards | 1 | Three modal implementations (shadcn Dialog vs two hand-rolled); custom div dropdowns beside Radix DropdownMenu in the same module; emoji icons vs lucide; blue-600/indigo/violet accents vs the purple-280/pink-326 token sy |
| 5 | Error prevention | 2 | Good: zero-count periods disabled, empty-content check before AI actions. Bad: re-clicking 'Push to Tasks Dashboard' creates duplicate tasks (selection persists after success, ai-notemaker.tsx:305); PDF export produces a |
| 6 | Recognition rather than recall | 2 | Empty state says 'Click the generate button' without indicating where that button lives (ai-notemaker.tsx:948); '(Unmapped)' requires knowing the member-mapping concept; export format buttons rely on emoji with no format |
| 7 | Flexibility and efficiency of use | 2 | No keyboard shortcuts anywhere in the group (no Cmd+Enter for chat, no regenerate); suggestions add a hard-coded 1000ms delay before fetching (suggestions.tsx:130); tag-input has genuinely good keyboard handling (Enter/E |
| 8 | Aesthetic and minimalist design | 1 | ai-notemaker is over-decorated: gradient icon chips, blur-glow loader with bouncing Sparkles, hover:scale-105/translate-y on every button, promo-styled export banner inside the results, 'Executive Summary' heading for ch |
| 9 | Help users recognize, diagnose, and recover from errors | 3 | note-editor-error-boundary is genuinely good (plain-language message, collapsible detail, Try Again); fetchWithRetry retries 5xx with backoff; fallback plain-text insertion path when markdown parse fails. Docked for sugg |
| 10 | Help and documentation | 2 | Icon buttons have title tooltips, dropdown items carry descriptions, error boundary gives next steps. No inline explanation of what each AI action does to the document (replace vs append is invisible until it happens). |
| **Total** | | **20/40** | |

## Anti-Patterns Verdict

The notes-editor core (BlockNote sync, error boundary, AI toolbar plumbing) is engineered with real care — retry with backoff, abort/cancel, atomic single-undo AI inserts — but the visible surface would make a Linear/Notion-fluent user pause repeatedly and lose trust at least twice. ai-notemaker.tsx is textbook AI-feature slop: Sparkles icons in five files, indigo-to-blue gradient chips, a blur-glow pulsing loader, emoji bullets (⚡📌📆📊🔄) as icons, and copy like "Structuring your intelligence..." / "No Intelligence Yet" / "Export your intelligence" — all in a blue-600 accent language that ignores Proddy's own purple/pink token system entirely. The module ships three different modal vocabularies (shadcn Dialog in export-note-dialog, two hand-rolled fixed-overlay modals in smart/), hand-rolled div dropdowns where Radix primitives exist one import away, and a "PDF" export that downloads an HTML file with a .pdf extension. Trust would survive the editor; it would not survive the AI panel or the exports.

**Deterministic scan**: 15 findings — bounce-easing ×6, ai-color-palette ×5, gray-on-color ×4, overused-font ×1.
Suspected false positives: 5 (ai-notemaker.tsx:408 gray-on-color — text-gray-500 is the resting state; bg-red-50 only applies on hover, where text becomes red-600; ai-notemaker.tsx:475 gray-on-color — conditional classes: text-gray-400 pairs with bg-gray-100, not bg-blue-100 (which pairs with text-blue-700); ai-notemaker.tsx:517 gray-on-color — conditional classes: text-gray-400 pairs with bg-gray-100, not bg-indigo-100 (which pairs with text-indigo-700); ai-notemaker.tsx:717 gray-on-color — bg-blue-50 is hover-only and hove)

## Cognitive Load

- Single focus: ai-notemaker results screen stacks Executive Summary + Action Items (with per-item assignee/priority editors) + Key Decisions + a promo-styled export banner + follow-up chat thread + a footer holding chat input, Push to Tasks, and Save Note — there is no designated next step.
- ≤4 visible options per decision point: period picker presents 6 choices (5 fixed + Since-last, ai-notemaker.tsx:445-523); the results footer offers 5 concurrent terminal actions (chat send, PDF, Word, Push to Tasks, Save Note).
- No working-memory bridges: empty state instructs 'Click the generate button' without locating it (ai-notemaker.tsx:948); toast leaks the raw key '(since_last)'; '(Unmapped)' assignee label assumes knowledge of AI-to-member mapping.
- Clear hierarchy: the three result sections use three different accent hues (blue FileText, green CheckCircle2, purple MessageSquare) — color coding that encodes nothing, plus the export banner's indigo card visually outranks the content it exports.
- Progressive disclosure: the chat input and export banner are permanently expanded before the user has read a single note; the two big footer buttons render even while the user is still triaging action items.

## What's Working

- ai-actions-toolbar.tsx: fetchWithRetry with exponential backoff on 5xx only, AbortController cancel affordance, and AI output inserted as a single atomic transaction = one undo step — exactly the right model for AI-modifying-content
- note-editor-error-boundary.tsx: plain-spoken failure copy, collapsed error detail for devs, Try Again — the best-designed error state in the group
- blocknote-editor.tsx save status badge: aria-live, non-intrusive corner placement, mirrors the actual debounce window instead of lying
- Period picker shows live message counts per option and disables zero-count periods; the 'Since last generation' option with elapsed-time context is genuinely thoughtful product design
- tag-input.tsx keyboard handling (Enter adds, Escape cancels, Backspace pops last tag) matches Linear/Notion conventions
- Responsive collapse of AI actions into a described dropdown below md (ai-actions-toolbar.tsx:325) is correct structural responsiveness per the register

## Priority Issues

### [P0] On mobile (<md), the click-to-close backdrop (fixed inset-0 z-[90], ai-notemaker.tsx:1035-1040) paints ON TOP of the AI panel — the panel div's z-20 is ignored because it has no position class, so every tap anywhere, including on the notes themselves, dismisses the panel.

**Why**: The entire AI notes feature is unusable on mobile: content is dimmed behind the backdrop and any interaction closes it, discarding the user's review-in-progress of action items.

**Fix**: Render the backdrop before the panel in DOM (or z-index it below), give the panel `relative z-[100]` (or portal it), and keep backdrop-close as an explicit affordance only outside the panel bounds.
**Files**: src/features/ai-notemaker/components/ai-notemaker.tsx

### [P1] Note exports are corrupt: convertToPDF returns base64 HTML in a file named .pdf (export-note-dialog.tsx:169-174), and every converter string-interpolates block.content which is an InlineContent[] array in BlockNote — real notes export as '[object Object],[object Object]'.

**Why**: Export is a trust-critical action; a .pdf that won't open in any PDF reader and markdown full of [object Object] reads as a broken product, and users may only discover it after sharing the file with someone else.

**Fix**: Delete the fake PDF option (or generate via jsPDF as daily-recap-modal already does); replace hand-rolled block conversion with editor.blocksToMarkdownLossy()/blocksToHTMLLossy() from the live editor instance; HTML export must escape title/content.
**Files**: src/features/notes/components/export-note-dialog.tsx

### [P1] Keyboard and screen-reader access is absent across the AI panel: assignee/priority pickers are click-only divs with no role/tabindex/aria-expanded (ai-notemaker.tsx:659-809), task selection is a decorative div-circle on a clickable card (no checkbox semantics, ai-notemaker.tsx:610-641), and summary-modal/daily-recap-modal are hand-rolled with no focus trap, aria-modal, or aria-labelledby.

**Why**: PRODUCT.md calls accessibility 'non-negotiable, not a phase two'; a keyboard-only user cannot assign, prioritize, deselect, or reach these controls at all — not degraded, impossible.

**Fix**: Replace custom dropdowns with the shadcn DropdownMenu/Select already used in ai-actions-toolbar; use real <Checkbox> (or button with aria-pressed) for task selection; rebuild both smart modals on components/ui/dialog.tsx which provides trap/ARIA/ESC/backdrop for free.
**Files**: src/features/ai-notemaker/components/ai-notemaker.tsx, src/features/smart/components/summary-modal.tsx, src/features/smart/components/daily-recap-modal.tsx

### [P1] The AI surfaces run on a parallel design system: blue-600 primary actions, indigo/violet gradients, gray-* text, rounded-xl/2xl, arbitrary px font sizes — zero use of the primary (purple 280) / secondary (pink 326) / muted / radius tokens — and blocknote-editor hard-codes theme="light" (line 234) so the notes editor ignores dark mode entirely, surviving only via the global `.dark [class*="bg-white"]` !important hack.

**Why**: Violates 'One system — every module speaks one grammar'; the AI assistant looks like a bolted-on third-party widget, and in dark mode its gray-50/blue-50/indigo-50 surfaces don't convert, producing light patches on dark chrome.

**Fix**: Sweep ai-notemaker.tsx, ai-actions-toolbar.tsx, and both smart modals to tokens (bg-primary, text-muted-foreground, border-border, rounded-lg/var(--radius)); pass resolvedTheme into BlockNoteView's theme prop; pick ONE accent for AI affordances and make it the brand secondary, not blue-600.
**Files**: src/features/ai-notemaker/components/ai-notemaker.tsx, src/features/notes/components/ai-actions-toolbar.tsx, src/features/notes/components/blocknote-editor.tsx, src/features/smart/components/summary-modal.tsx, src/features/smart/components/daily-recap-modal.tsx

### [P2] Task-push flow has no idempotence or continuity: after 'Push to Tasks Dashboard' succeeds, tasks stay selected so a second click creates duplicates; success is a toast with no link to the created tasks; a single generation fires two stacked success toasts (ai-notemaker.tsx:244, 250).

**Why**: Competent operators will double-click or re-push after refining; duplicate tasks in the planning module are expensive to clean up, and toast noise trains users to ignore feedback.

**Fix**: After successful push, mark pushed items (checkmark + disabled or 'View in Tasks' link), clear selection, and collapse the two generation toasts into one.
**Files**: src/features/ai-notemaker/components/ai-notemaker.tsx

### [P2] suggestions.tsx fabricates AI output: on API failure it silently shows canned strings ('Thanks for sharing! This is really helpful.') under the 'AI suggestions' label, and delays every fetch by a hard-coded 1000ms (line 130).

**Why**: Violates 'AI is a fast, reliable colleague — not a wizard' and 'calm under load'; users send a canned platitude believing it was context-aware, and the artificial second of latency contradicts 'fast is a feature'.

**Fix**: On failure show a quiet inline 'Suggestions unavailable — Retry' state instead of fake content; remove the setTimeout and fetch as soon as messages resolve.
**Files**: src/features/smart/components/suggestions.tsx

### [P3] Copy register is off across the group: 'Structuring your intelligence...', 'No Intelligence Yet', 'Export your intelligence', 'Executive Summary' (for chat notes), '✅ Notes saved to Meeting Notes history!', exclamation marks on nearly every toast, emoji in toasts and buttons.

**Why**: PRODUCT.md: verbs over adjectives, exclamation marks rare, AI never dressed as magic — this copy is the exact anti-reference.

**Fix**: Rewrite to plain statements: 'Generating notes…', 'No notes yet — generate from this channel's messages', 'Summary', 'Saved to meeting notes', 'PDF' / 'Word' without the 'intelligence' framing; strip emoji and exclamation marks.
**Files**: src/features/ai-notemaker/components/ai-notemaker.tsx, src/features/notes/components/blocknote-notes-editor.tsx, src/features/notes/components/ai-actions-toolbar.tsx

## Persona Red Flags

- Alex (impatient power user): two stacked success toasts per generation (ai-notemaker.tsx:244,250); hard-coded 1000ms delay before suggestions fetch (suggestions.tsx:130); no Cmd+Enter or any shortcut in the chat form; hover:scale-105/-translate-y-0.5 on every footer button adds perceived lag to rapid clicking; follow-up chat answers don't auto-scroll into view (effect dep array is [] at ai-notemaker.tsx:134-138).
- Sam (screen-reader/keyboard-only): assignee and priority pickers are non-focusable divs with onClick and no role/aria-expanded (ai-notemaker.tsx:660-676, 743-760) — task triage is impossible; task select 'checkbox' is a div inside a clickable card with no semantics (ai-notemaker.tsx:624-641); summary-modal.tsx and daily-recap-modal.tsx have role=dialog but no focus trap, no aria-modal, no aria-labelledby, and focus stays behind the overlay; tag remove buttons announce as unlabeled buttons (tag-input.tsx:92-98); 'Cancel' link at text-gray-400 (~2.5:1) also fails contrast for everyone.
- Casey (distracted mobile): the z-[90] backdrop overlays the entire AI panel below md so any tap dismisses it mid-review (ai-notemaker.tsx:1035-1040); summary/daily-recap modals are w-full with no outer padding — full-bleed with clipped rounded corners at 375px (summary-modal.tsx:69-71, daily-recap-modal.tsx:269-271); footer stacks chat input + two h-12 buttons vertically, pushing generated content far above the fold.

## Minor Observations

- ai-notemaker.tsx: 'Executive Summary' generated-at metadata and Cancel link at text-gray-400 (~2.5:1 on white) fail WCAG contrast; text-[10px] indigo-400 on indigo-50 fails harder
- ai-notemaker.tsx: '0 msgs' count badge (gray-400 on gray-100) fails contrast exactly when its information matters most
- No motion-reduce handling anywhere in the group (animate-bounce typing dots, animate-pulse glow, hover scales) and globals.css has no prefers-reduced-motion block
- ai-notemaker.tsx: header backdrop-blur + export banner backdrop-blur-sm are decorative glass — nothing scrolls beneath the banner
- ai-notemaker.tsx: 'Follow-up Discussion' divider is a tiny uppercase tracked-widest kicker — one instance of the eyebrow pattern
- export-note-dialog.tsx: 'Share in Chat' silently requires a channel context but the button renders regardless and only errors on click
- daily-recap-modal.tsx / summary-modal.tsx: onKeyDown stopPropagation on the dialog div blocks nothing useful and role=dialog without aria-modal leaves背景 content in the a11y tree
- blocknote-editor.tsx vs blocknote-notes-editor.tsx: two listeners for the same custom event can insert AI notes twice
- notes-room.tsx: roomId normalization (String().trim() of a template literal) is dead defensive code
- ai-notemaker.tsx: unused _variant prop suggests a half-removed toolbar/default mode

## Per-Component Notes

- `src/features/ai-notemaker/components/ai-notemaker.tsx` — Token sweep: blue-600/indigo/gray-* → primary/secondary/muted tokens; rounded-2xl → rounded-lg; text-[15px]/[11px]/[10px]/[9px]/[8px] → scale steps. Fix backdrop z-order (P0), chat autoscroll dep array, duplicate-push guard, '(since_last)' toast leak, and double success toasts.
- `src/features/ai-notemaker/components/ai-notemaker.tsx` — Replace custom div dropdowns with shadcn DropdownMenu/Select and the div-circle selectors with real Checkbox; `size-4.5` is not a Tailwind utility so the three header icons render unsized (lines 393, 403, 414) — use size-4 or size-5.
- `src/features/notes/components/export-note-dialog.tsx` — Remove fake PDF (base64 HTML as .pdf); use editor.blocksToMarkdownLossy/blocksToHTMLLossy instead of interpolating InlineContent[] (renders [object Object]); escape title/content in HTML export; delete the single-tab Tabs wrapper; swap emoji format icons (📝🌐📋📄) for lucide to match the icon system.
- `src/features/smart/components/daily-recap-modal.tsx` — Rebuild on components/ui/dialog (focus trap, aria, backdrop-close, ESC for free); delete dead _handleExportMarkdown/_handleExportJSON/_handleExportText and the duplicated markdown-stripping regex block (lines 111-118 vs 151-158); dark:bg-zinc-900 and text-gray-500 → tokens.
- `src/features/smart/components/summary-modal.tsx` — Same rebuild on ui/dialog; add outer p-4 so it isn't full-bleed on mobile; 'Cached Summary' title + cache explainer is plumbing exposed to users — a small 'cached' badge with timestamp says it better.
- `src/features/smart/components/suggestions.tsx` — Never present FALLBACK_SUGGESTIONS as AI output on API failure — show 'Suggestions unavailable · Retry'; remove the 1000ms setTimeout; consider not refetching on every incoming message (cost + churn while user is composing).
- `src/features/notes/components/blocknote-editor.tsx` — theme="light" hard-coded — wire to the app's class dark mode; 'Initialize Editor' fallback is dev-speak ('This note is empty — start writing' + auto-create); violet-500/600 → primary token; move inline style object to classes.
- `src/features/notes/components/ai-actions-toolbar.tsx` — Unkeyed fragment wrapping DropdownMenuItem+Separator in the map (line 344) throws React key warnings — key the fragment; gradient band + gradient icon chip → flat token surface; bouncing dots need motion-reduce variant; mobile dropdown items don't reflect per-action loading state.
- `src/features/notes/components/tag-input.tsx` — Add aria-label={`Remove ${tag}`} to X buttons; TAG_COLORS pastel-100/800 pairs have no dark-mode variants; consider comma as an add-tag delimiter alongside Enter.
- `src/features/notes/components/notes-room.tsx` — 'Loading note...' is unstyled plain text (no muted-foreground, no spinner) inconsistent with the fallback spinner below; 'Error: Invalid room ID' is dev-speak; initialPresence/initialStorage carry canvas fields (pencilDraft, penColor, layers) into a notes room.
- `src/features/notes/components/note-editor-error-boundary.tsx` — violet-600 button → primary token + add focus-visible ring to match shadcn Button; 'contact your admin to re-initialize this note' misfits small self-serve teams — offer 'Reset note content' or link to support instead.
- `src/features/notes/components/blocknote-notes-editor.tsx` — Duplicates the proddy:insert-ai-notes listener already registered in blocknote-editor.tsx — same event handled twice risks double insertion; pick one owner. Toast 'Inserted AI notes into document!' → drop the exclamation.

## Questions to Consider

- Is ai-notemaker the surviving surface for chat-notes, or is it being superseded by the meeting-notes history it writes into? The unused _variant prop and duplicated event listeners suggest a half-finished migration — worth knowing before investing in the P1 token sweep.
- Is dark mode an officially supported surface for the notes editor? theme="light" plus the global `.dark [class*="bg-white"]` !important hack implies it was never decided; the right fix differs (wire the theme vs. declare notes light-only).
- Is mobile in scope for the AI notemaker panel? The z-[90] backdrop bug suggests it was never opened on a phone — if mobile matters, the fix is urgent; if not, the overlay should be removed rather than half-supported.
