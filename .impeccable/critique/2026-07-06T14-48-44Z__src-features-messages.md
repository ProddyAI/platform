---
target: Messaging (channels, chats/DMs, messages)
total_score: 19
p0_count: 0
p1_count: 4
timestamp: 2026-07-06T14-48-44Z
slug: src-features-messages
---
# Critique — Messaging (channels, chats/DMs, messages)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/messages, src/features/chats, src/features/channels

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | isPending (fires on reaction toggle/edit/delete alike) collapses the whole message to scale-y-0 with bg-rose-500/50 (compact-message.tsx:59-60, full-message.tsx:66-67) — adding an emoji visually crushes the row with an e |
| 2 | Match between system and real world | 3 | Chat conventions well-followed (Today/Yesterday dividers, hash/user badges, threads); minor: 'Meeting Ended' as a card title reads like a system log, and export/file cards use jargon-y labels |
| 3 | User control and freedom | 2 | Selection bar (selection-modal.tsx:224-266) has no clear/dismiss control — only copy/delete/summarize; create-channel-modal.tsx:191 open={open || isPending} + onOpenChange={handleClose} means Escape during a slow create  |
| 4 | Consistency and standards | 1 | Two thread UIs with different rendering (thread.tsx uses the full Message component; thread-modal.tsx flattens to plain text); three dark-mode neutrals in one module (dark:bg-[#1a1a1a] menu, dark:bg-zinc-800 bar, dark:ho |
| 5 | Error prevention | 2 | Bulk-delete confirm + ownership gating are good; but task-creation-modal.tsx lets you create a task with an empty title; message type detection via body.includes('"type":"file"') (message-content.tsx:80-91) misclassifies |
| 6 | Recognition over recall | 2 | Every message action (edit, delete, reply, add-as-task, select) is reachable only via right-click with zero visible affordance in these components; timestamps are opacity-0 until hover (compact-message.tsx:72); once the  |
| 7 | Flexibility and efficiency | 2 | Batch select/copy/delete/summarize and editable thread titles are genuine power features; but no keyboard path to any of them, no long-press story for touch, and the thread modal forces manual 'Load older replies' clicks |
| 8 | Aesthetic and minimalist design | 2 | Chat rows are appropriately dense and quiet; unified-message.tsx (glow shadows, pulse dots, 4 font weights, uppercase micro-type) and thread-modal's gradient chips (bg-gradient-to-r from-slate-50 to-slate-100, lines 347/ |
| 9 | Help users recover from errors | 2 | Failures surface as generic toasts ('Failed to send message.') with no retry affordance and the composed message state depends on the editor key not resetting; partial bulk-delete does report '{n} of {m} deleted' which i |
| 10 | Help and documentation | 1 | 'Max 5MB for images' helper sits under the Channel Name field, describing the icon uploader two elements away (create-channel-modal.tsx:319-321); 'No replies yet' empty state teaches nothing (thread-modal.tsx:511-514); n |
| **Total** | | **19/40** | |

## Anti-Patterns Verdict

A user fluent in Slack and Linear would trust the core chat rows — compact/full message layout, date dividers, and the channel modal are conventional and mostly quiet — but they would pause hard at three places. First, unified-message.tsx is unmistakable AI slop: an off-brand indigo accent invented for one card, hard-coded #0a0a0f/#12121a backgrounds, font-black uppercase tracking-widest 10px micro-labels, glow shadows (shadow-[0_0_8px_rgba(...)]), pulsing dots, rounded-2xl chips, and 500ms transition-all — none of it speaking the app's purple/pink token grammar, and half of it dead code because globals.css force-overrides [data-message-component="true"] to stay light in dark mode. Second, the right-click-only custom context menu (role="dialog", z-index 9999999, a full-bleed purple "Add as Task" block mid-menu) reinvents a standard affordance badly. Third, the thread experience exists twice with two different visual grammars — a rich panel and a modal that silently flattens replies to the first Quill op as plain text. The surface reads as three different products stitched together, which is exactly what PRODUCT.md says Proddy must not feel like.

**Deterministic scan**: 0 findings.

## Cognitive Load

- Clear hierarchy — FAIL in unified-message.tsx: one small card mixes 3 font sizes (10/11/14px), 4 weights (semibold→black), uppercase tracked micro-labels, and two competing accents (indigo + emerald); nothing tells the eye what matters first
- No working-memory bridges — FAIL: 'Max 5MB for images' renders under the Channel Name input, two elements away from the upload square it describes (create-channel-modal.tsx:319-321); and all message actions require remembering that right-click is the only entry point — no visible cue exists
- One decision at a time — FAIL in create-channel-modal.tsx icon area: an upload square, an overlapping emoji sub-button (bottom-right), and a remove badge (top-right) stack three affordances into 80px, with emoji-vs-image mutual exclusion communicated only by state resets after the fact
- <=4 visible options per decision point — BORDERLINE: the context menu presents up to 7 actions; the hr-grouping helps, but the filled purple 'Add as Task' block breaks scan order by hijacking attention mid-list
- Single focus, chunking, visual grouping, progressive disclosure — PASS: message rows, the selection bar, and the thread panel each keep one job on screen

## What's Working

- Compact/full message split with 15-minute grouping threshold and hover timestamps follows the Slack-fluent user's mental model exactly (thread.tsx:315-323, compact-message.tsx)
- Selection flow has real thoughtfulness: Delete button only renders when every selected message is owned by the current user (selection-modal.tsx:206-254), and partial failures report '{n} of {m} deleted' honestly
- create-channel-modal.tsx handles the unglamorous edges well: blob-URL revocation on every path, 5MB/type validation with specific error toasts, auto-kebab-casing of channel names, and a plan-limit banner with upgrade affordance
- Author messages use bg-primary with primary-foreground — the one place the purple brand token is used correctly as a selection/identity signal (message-content.tsx:112-114)
- Dialog copy in the channel modal is on brand voice: says what channels are for, then stops

## Priority Issues

### [P1] Reacting to, editing, or deleting any message collapses the entire message row to zero height with a translucent red background: isPending from use-message-actions.ts:54 (true during reaction toggles and edits, not just deletes) drives 'origin-bottom scale-y-0 transform bg-rose-500/50'

**Why**: The most common micro-interaction in a chat app (adding an emoji) makes the message visually vanish in error-red for the duration of the mutation — users will read it as their message being deleted or a failure, on every single reaction

**Fix**: Scope the collapse animation to the remove mutation only (pass isRemoving separately), replace rose-500/50 with a subtle opacity-60 pending treatment for edits/reactions, and use hsl(var(--destructive)) if a red delete animation is kept; add motion-reduce guard
**Files**: src/features/chats/components/compact-message.tsx, src/features/chats/components/full-message.tsx, src/features/chats/hooks/use-message-actions.ts

### [P1] unified-message.tsx breaks the design system wholesale: invented indigo accent (indigo-600/500/400 throughout), hard-coded hex darks (dark:bg-[#0a0a0f], dark:bg-[#12121a]), font-black/font-extrabold, text-[10px] uppercase tracking-widest labels, shadow-2xl + shadow-indigo-500/10 glows, animate-pulse dot with shadow-[0_0_8px_rgba(16,185,129,0.6)], rounded-2xl, transition-all duration-500, and !important overrides fighting globals.css — which itself force-locks [data-message-component="true"] to a white background in dark mode (globals.css:210-214), making all the dark: styles dead code with unpredictable winners

**Why**: This card appears inline in every channel for canvases, notes, files, and meetings — the highest-visibility shared object in messaging — and it looks like it belongs to a different, louder product; the 10px indigo-400-on-white uppercase label also fails contrast (~3.4:1)

**Fix**: Rebuild on tokens: bg-card/border-border/text-foreground, primary for the action button (default Button variant, no ! overrides), one font-weight step (medium/semibold), text-xs metadata in muted-foreground, rounded-lg, shadow-sm, duration-fast; delete the [data-message-component] override block in globals.css and let the card theme itself
**Files**: src/features/messages/components/unified-message.tsx, src/app/globals.css

### [P1] All message actions live exclusively in a hand-rolled right-click context menu: fixed-position div with role="dialog", tabIndex=-1, z-[9999999], no focus trap, no arrow-key navigation, no Escape handling, no viewport collision handling, hard-coded dark:bg-[#1a1a1a], a text checkmark '✓ Selected', and a full-width purple 'Add as Task' block mid-menu

**Why**: Keyboard and screen-reader users (Sam) cannot edit, delete, reply, or select messages at all; mouse users near the viewport bottom/right get a clipped menu; and reinventing a standard affordance is an explicit product-register ban

**Fix**: Replace with Radix DropdownMenu/ContextMenu (already the app's primitive layer) fed by the same action handler; add a visible on-hover/on-focus action strip on message rows as the discoverable path; style 'Add as Task' as a normal menu item with a leading icon, not a filled block
**Files**: src/features/chats/components/message-context-menu.tsx

### [P1] thread-modal.tsx renders parent and replies as plain text via parseMessageBody, which returns only parsed.ops[0].insert (line 201-207) — dropping all rich-text formatting after the first op, all images, and all reactions; the same ~130-line special-content block is copy-pasted twice (lines 345-395 vs 454-504); and auto-scroll-to-bottom sets scrollTop on the ScrollArea Root (overflow-hidden) instead of the Radix Viewport, so it never scrolls (lines 142-150)

**Why**: A user opening a thread from this modal sees a silently truncated, unformatted version of the conversation that contradicts what the thread panel (thread.tsx) shows for the same data — silent data loss plus two visual grammars for one object

**Fix**: Reuse the shared Renderer/Message components inside the modal (as thread.tsx does), extract the special-content chip into one component, and scroll via a ref on an inner sentinel element (scrollIntoView) or the Viewport
**Files**: src/features/messages/components/thread-modal.tsx

### [P2] The selection action bar has no way to cancel a selection — its only controls are Copy, Delete (conditional), and Summarize; Copy does not clear the selection either

**Why**: Once a user selects messages (possibly by accident from the context menu), the pink bar sits over the bottom-right of the screen — on mobile, over the composer — until they deselect each message individually or complete a destructive/AI action

**Fix**: Add an X 'Clear selection' ghost button to the bar and clear selection after a successful copy; on small screens dock the bar full-width above the composer instead of floating bottom-right
**Files**: src/features/chats/components/selection-modal.tsx

### [P2] Form-state gaps in both creation modals: task-creation-modal.tsx has no validation (empty title allowed), no loading/disabled state on Create, and no error handling; create-channel-modal.tsx shows no pending label on Create, locks the dialog open during mutation while onOpenChange still wipes the form (open={open || isPending}, line 191), and puts the icon-upload helper text under the name field

**Why**: The register requires default/hover/focus/disabled/loading/error on every interactive component; here a double-click on Create fires twice, an Escape mid-create silently erases the user's input, and the misplaced helper is a working-memory bridge

**Fix**: Disable Create when title is empty and while pending ('Creating…'), guard onOpenChange with isPending so a locked dialog doesn't reset state, and move 'Max 5MB for images' next to the upload square
**Files**: src/features/chats/components/task-creation-modal.tsx, src/features/channels/components/create-channel-modal.tsx

### [P2] Token discipline is broken module-wide: three different dark neutrals (dark:bg-[#1a1a1a], dark:bg-zinc-800, dark:hover:bg-slate-700/50, dark:bg-gray-800), hard-coded light grays (hover:bg-gray-100/60 vs hover:bg-gray-200/40 for the same hover on compact vs full rows, border-gray-300 date pills, bg-blue-50/text-blue-700 and bg-purple-50 badges), and text-gray-500 '(edited)' instead of muted-foreground

**Why**: Dark mode currently depends on a pile of !important overrides in globals.css to un-break these hard-coded values; every new hard-coded gray adds another special case, and the two different row-hover grays are visibly inconsistent when scrolling between grouped and ungrouped messages

**Fix**: Sweep to tokens: hover:bg-muted/60 on both row types, popover/border for the menu and date pills, muted-foreground for metadata, and one semantic badge treatment for channel/DM context
**Files**: src/features/chats/components/compact-message.tsx, src/features/chats/components/full-message.tsx, src/features/chats/components/message-content.tsx, src/features/chats/components/message-context-menu.tsx, src/features/messages/components/thread.tsx, src/features/messages/components/thread-modal.tsx

## Persona Red Flags

- Alex (impatient power user): saving a thread title requires clicking a 24x24px check button — Enter does nothing, Escape does nothing (thread.tsx:258-283); thread-modal.tsx makes him click 'Load older replies' repeatedly where the panel infinite-scrolls; broken autoscroll (ScrollArea root ref, thread-modal.tsx:142-150) means every thread opens scrolled to the wrong place
- Sam (screen reader/keyboard-only): cannot act on any message — the context menu only opens from the contextmenu mouse event and announces itself as a nameless dialog (message-context-menu.tsx:41); timestamps are opacity-0 buttons with no focus-visible reveal (compact-message.tsx:72); Edit2/Check/X title buttons in thread.tsx and the Download buttons in thread-modal.tsx have no aria-label; avatar button in full-message.tsx:76 is unlabeled
- Riley (stress-tester): a message whose text contains the literal string '"type":"file"' is misrendered as a file card (message-content.tsx:80-91); the channel/DM badge in thread-modal.tsx:299-318 has no truncation, so a long conversation name blows out the modal header; the thread title input has no maxLength (thread.tsx:260); selecting 250 messages and hitting Summarize warns but proceeds anyway (selection-modal.tsx:57-64)

## Minor Observations

- thread.tsx:352-370 — IntersectionObserver created in a ref callback whose returned cleanup is ignored by React <19: a new observer leaks on every render of the sentinel
- thread-modal.tsx:137-140 — reset effect has an empty dependency array, so allReplies never resets when the `thread` prop changes while the component stays mounted (stale replies from the previous thread flash)
- compact-message.tsx:68-88 — the isAuthor ternary renders two byte-identical branches; dead duplication
- unified-message.tsx:165 — getButtonText export branch: `isCanvas ? "View Export" : "View Export"` — both sides identical
- unified-message.tsx:222 — canvas/note navigation uses window.location.href (full page reload) plus a cache-busting &t=Date.now(), while meetings use router-friendly paths; inconsistent and slow
- selection-modal.tsx toasts: 'Summary generated successfully' — 'successfully' is filler against the brand voice; 'Summary ready' says it and stops
- Copy casing is inconsistent: 'Select Message'/'Copy Message'/'Add as Task' (Title Case) vs 'Load older replies' (sentence case) in the same surface
- No motion-reduce guards anywhere: animate-pulse dots (unified-message.tsx:251,298), animate-fade-in on '(edited)', and the scale-y collapse all run under prefers-reduced-motion
- thread-modal.tsx:77 — allReplies is typed any[]; the module otherwise carries full Convex types
- message-content.tsx:139 — the 20-selector [&_p]:text-white cascade is a symptom of the Renderer not accepting a tone prop; fix at the source
- message-content.tsx:106 — cursor-pointer on the whole bubble advertises a click that does nothing (the action is right-click only): a false affordance
- thread.tsx:308-311 — date-divider pill is hard-locked to bg-white/border-gray-300 and depends on the globals.css messages-scrollbar exemption to survive dark mode

## Per-Component Notes

- `src/features/messages/components/unified-message.tsx` — Full rebuild on tokens: drop indigo/hex darks/font-black/uppercase micro-labels/glow shadows/pulse/rounded-2xl/duration-500; use bg-card, border-border, default Button, one weight step; then delete the globals.css [data-message-component] force-light override this card currently fights
- `src/features/chats/hooks/use-message-actions.ts` — Split isPending into isRemoving vs isMutating so reaction toggles and edits stop triggering the row-collapse animation downstream
- `src/features/chats/components/message-context-menu.tsx` — Replace with Radix DropdownMenu (role=menu, focus trap, arrow keys, Escape, collision-aware); demote 'Add as Task' from filled purple block to a normal item with icon; swap '✓ Selected' text glyph for a Check icon; tokens instead of gray-*/#1a1a1a
- `src/features/messages/components/thread-modal.tsx` — Reuse Renderer/Message for parent+replies (kills the ops[0].insert truncation and the duplicated 130-line chip block); scroll via viewport/sentinel not the ScrollArea root; remove slate gradient chips; add loading state to 'Load older replies'; truncate the context badge; reset pagination when thread changes
- `src/features/chats/components/compact-message.tsx` — Delete the duplicated isAuthor ternary; give the timestamp button focus-visible:opacity-100; align hover bg with full-message (currently gray-100/60 vs gray-200/40) and tokenize both
- `src/features/chats/components/full-message.tsx` — aria-label the avatar button ('View {authorName} profile'); tokenize hover:bg-gray-200/40; scope the rose collapse to deletes only
- `src/features/chats/components/message-content.tsx` — Replace substring type-detection with a tryParse of body JSON checking parsed.type; remove cursor-pointer false affordance; pass a tone/inverse prop to Renderer instead of the 20-selector text-white cascade; '(edited)' → text-muted-foreground
- `src/features/chats/components/selection-modal.tsx` — Add 'Clear selection' X; clear after successful copy; block (not warn-and-continue) summarize over the 200-message cap; dock full-width above composer on mobile; Summarize button should be the standard secondary Button variant, not bg-secondary/70 hover hack
- `src/features/channels/components/create-channel-modal.tsx` — Pending label on Create ('Creating…'); guard onOpenChange so Escape during pending doesn't wipe state while the dialog stays open; move 'Max 5MB for images' beside the uploader; tokenize border-gray-300/bg-gray-50; surface the 3-char minimum as visible helper text
- `src/features/messages/components/thread.tsx` — Use the Input primitive for title editing with Enter=save/Escape=cancel and aria-labels on Edit2/Check/X; hoist the IntersectionObserver into useEffect; maxLength on title; tokenize the date-divider pill so it stops needing globals.css dark-mode exemptions
- `src/features/chats/components/task-creation-modal.tsx` — Disable Create on empty title and while pending; add error handling; consider the app's date-picker component over the native date input for vocabulary consistency

## Questions to Consider

- Is thread-modal.tsx still a live surface, or superseded by the thread panel (thread.tsx)? If it's reachable from mentions/activity views, the truncated plain-text rendering is silent data loss; if it's dead, delete it rather than fix it.
- Is the scale-y-0 + rose treatment on isPending intended as a delete animation? It currently fires on reaction toggles and edits too — confirming intent decides whether the fix is scoping or removal.
- Does a hover action toolbar exist in the shared components/messaging/message.tsx layer? These feature files show right-click as the only action path; if a toolbar exists upstream, the discoverability finding downgrades from P1 to P2 for mouse users (the keyboard/SR gap remains).
