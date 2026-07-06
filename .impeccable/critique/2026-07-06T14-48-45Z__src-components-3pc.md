---
target: Shared components (messaging, pickers, providers, 3pc, root)
total_score: 22
p0_count: 1
p1_count: 3
timestamp: 2026-07-06T14-48-45Z
slug: src-components-3pc
---
# Critique — Shared components (messaging, pickers, providers, 3pc, root)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/components/3pc, src/components/messaging, src/components/pickers, src/components/providers, src/components/hint.tsx, src/components/limit-indicator.tsx, src/components/mentions-notification-dialog.tsx, src/components/navigation-listener.tsx, src/components/theme-toggle.tsx

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Pending/disabled/typing states exist, but daily-recap emits loading toast + success toast + modal (triple feedback, message-list.tsx), and OneSignal opt-in happens silently with no UI status |
| 2 | Match between system and real world | 2 | Mention picker inverts every known convention: results above, search input below, both detached from the caret (mention-picker.tsx:120-186); '!' as a calendar trigger is an invented gesture no one expects |
| 3 | User control and freedom | 2 | Typing '!' hijacks the user into a modal (editor.tsx:268-272); mentions-notification-dialog.tsx:392 hides the dialog close button via [&>button]:hidden — Esc is the only exit |
| 4 | Consistency and standards | 1 | Blue accent system in notifications vs brand pink/purple; slate + gray + token colors mixed in one class list (editor.tsx:1065); two tooltip stacks (hint.tsx vs emoji-popover.tsx); native <select> in calendar-picker vs s |
| 5 | Error prevention | 2 | '!' false-triggers on ordinary sentences; renderer.tsx:153-219 silently strips 'Today'/'Tomorrow'/date strings from user text; isEmpty guards and ConfirmDialog do exist |
| 6 | Recognition over recall | 3 | Icon buttons all carry Hint tooltips and Shift+Enter tip shows contextually, but the '!' / '@' / '#' text gestures are undiscoverable in the UI; ThreadBar drops the reply count it receives |
| 7 | Flexibility and efficiency | 2 | @/# autocomplete exists but has zero keyboard navigation — keydown is stopPropagation'd, no arrow/Enter select (mention-picker.tsx:86, channel-picker.tsx:86), and focus is stolen from the editor into the picker's search  |
| 8 | Aesthetic and minimalist design | 2 | Composer exposes ~11 always-visible controls in two clusters; every notification row carries a badge + a mark-read button + a decorative separator; limit-indicator.tsx pulses forever |
| 9 | Help users recover from errors | 2 | Generic 'Failed to send message.' toast with no retry (chat-input.tsx:213); renderer error path is a bare unstyled <div>Error displaying message</div> (renderer.tsx:240); limit banner does link to upgrade (good) |
| 10 | Help and documentation | 3 | Empty states teach per tab (notifications dialog), tooltips everywhere, shortcut hint — but text triggers and the recap sparkle button get no explanation beyond a 2-word tooltip |
| **Total** | | **22/40** | |

## Anti-Patterns Verdict

A user fluent in Linear or Slack would trust the skeleton but stumble on the seams. The bones are honest shadcn/Radix product UI — real states, real tooltips, a genuinely well-built issue-picker — but the surface is patched, not designed: the notifications dialog runs an entire off-brand blue accent system with hand-written dark: pairs for every gray, the mention/channel pickers are light-only panels pinned 120px from the viewport bottom at z-9999 with the search box under the results, dark mode is held together by a global `.dark [class*="bg-white"] !important` string-match hack, and typing an exclamation mark at the end of a sentence opens a modal calendar. It doesn't read as AI-slop decoration — there are no gradients or hero metrics — it reads as accumulated AI-assisted patches that never got a systems pass. The register failure here is 'strangeness without purpose' in interaction, not in visuals.

**Deterministic scan**: 0 findings.

## Cognitive Load

- ≤4 visible options per decision point — FAIL: editor.tsx composer exposes ~11 always-visible controls (5 overlay: calendar/notes/canvas/files/meets + 6 bottom: formatting, emoji, attach, @, #, send)
- No working-memory bridges — FAIL: mention flow splits input between the editor ('@jo' stays as literal text) and the picker's separate bottom search field; user must mentally reconcile both, and handleMentionSelect later deletes back to lastIndexOf('@')
- Single focus — FAIL: message-list.tsx date divider does double duty as an AI-recap trigger repeated on every date group; each notification row has three competing interactive zones (row link, mark-read button, source badge)
- Progressive disclosure — FAIL: all five attach-type actions surfaced permanently instead of behind one menu; UploadRecordingButton floats in its own ungrouped row above the composer (chat-input.tsx:255-257)
- Clear hierarchy — PARTIAL: notifications dialog All and Unread tabs carry the identical unreadCounts.all badge, a duplicated signal that adds noise without information

## What's Working

- typing-indicator.tsx is the model for the register: reduced-motion aware, 200ms, quiet, state-conveying only
- issue-picker-popover.tsx is genuinely excellent — cmdk pattern, complete loading/empty/pending/disabled states, live selected count, monospace IDs, on-voice empty copy ('Every issue is already here.')
- Button primitive ships the full state vocabulary (focus-visible ring, active scale, disabled) so most surfaces inherit accessibility for free
- @ and # autocomplete triggers plus Enter-to-send / Shift+Enter match Slack muscle memory; the shortcut hint only appears while composing
- Notifications dialog empty states teach the interface per tab instead of saying 'nothing here'
- Providers (modal, jotai, convex) are clean and invisible; convex-client-provider fails fast on missing env instead of dying downstream
- LimitIndicator connects the limit state directly to the billing upgrade path — good error-recovery routing even if the styling is noisy

## Priority Issues

### [P0] Any message whose text ends in '!' pops the modal 'Add Calendar Event' dialog mid-typing (TEXT_CHANGE handler checks plainText.trim().endsWith('!'))

**Why**: This is a chat product — 'Ship it!' or 'great!' interrupts the core task with a focus-stealing modal. Violates the register's 'modal as first thought' ban and PRODUCT.md's 'interface gets out of the way'. Every user hits this within a day.

**Fix**: Remove the '!' text trigger entirely; keep the explicit Calendar toolbar button, or replace with a non-modal inline suggestion chip (like the @ picker) that only appears for an explicit token such as '/event'
**Files**: src/components/messaging/editor.tsx

### [P1] Mention and channel pickers are keyboard-dead, screen-reader-invisible, and mispositioned: role='presentation' + onKeyDown stopPropagation swallow all keys, no arrow/Enter selection, focus is yanked from the editor into a search input placed BELOW the results, and the panel is fixed at bottom-[120px] z-[9999] regardless of where the composer actually is

**Why**: Slack-fluent users type '@nam⏎'; here they must grab the mouse or Tab through every row. Sam (keyboard/SR) cannot use mentions at all. The fixed offset breaks in threads, edit mode, and when attachments grow the composer.

**Fix**: Rebuild both as one caret-anchored cmdk popover (the pattern already exists in issue-picker-popover.tsx): typing stays in the editor as the filter, ArrowUp/Down + Enter select, Esc closes, tokens from popover/border/muted
**Files**: src/components/pickers/mention-picker.tsx, src/components/pickers/channel-picker.tsx, src/components/messaging/editor.tsx

### [P1] renderer.tsx mutates user message text: for calendar-event messages it string-replaces ~30 date formats plus the literal words 'Today', 'Tomorrow', and 'Next week - *' out of the body before display

**Why**: A message like 'Today was rough, moving standup Tomorrow!' renders with words silently deleted. Users' own words are the product; silently rewriting them destroys trust (Riley-tier failure, guaranteed with common words)

**Fix**: Stop post-hoc string surgery: store the calendar token's range or a placeholder in the message payload at compose time, and render the event as a discrete chip after the untouched text
**Files**: src/components/messaging/renderer.tsx, src/components/messaging/editor.tsx

### [P1] Dark mode is built on a global `.dark [class*="bg-white"] { background !important }` string-match hack plus hard-coded light-only palettes (pickers use bg-white/bg-gray-50/hover:bg-gray-100; editor mixes border-slate-200 with dark:border-gray-700; notifications dialog hand-writes a parallel dark: pair for every gray/blue)

**Why**: Pickers half-theme in dark mode (bg-gray-50 headers stay light over dark-mapped bodies), and any token change requires touching dozens of literals — the opposite of 'One system'

**Fix**: Replace literals with popover/card/muted/accent/border tokens in the five worst files, then delete the [class*='bg-white'] override from globals.css once nothing depends on it
**Files**: src/components/pickers/mention-picker.tsx, src/components/pickers/channel-picker.tsx, src/components/mentions-notification-dialog.tsx, src/components/messaging/editor.tsx, src/app/globals.css

### [P2] tidio-chat.tsx interpolates currentUser.name and email unescaped into an inline <Script dangerouslySetInnerHTML> template string

**Why**: A display name containing `"};alert(1);//` executes arbitrary JS for that user's sessions — stored XSS via profile name; also the identify logic is duplicated in both React effect and inline script

**Fix**: Drop the inline script entirely and use only the existing useEffect path (window.tidioIdentify + setVisitorData), or JSON.stringify every interpolated value
**Files**: src/components/3pc/tidio-chat.tsx

### [P2] Notifications dialog runs an entire blue accent system (blue bell chip, blue 'n new' badge, blue mark-all button, blue unread row tint, blue tab badges) and hides its own close button with [&>button]:hidden; All and Unread tabs show the identical badge count

**Why**: Brand accent is pink/purple (secondary 326/primary 280) — a blue surface reads as a different product bolted on, exactly what PRODUCT.md says Proddy must not feel like; the hidden close removes the standard escape affordance

**Fix**: Swap blue-* for secondary/primary/muted tokens, restore the Dialog close button, drop the duplicate badge on the Unread tab and the per-row decorative separators
**Files**: src/components/mentions-notification-dialog.tsx

### [P2] Composer affordance overload: 5 absolutely-positioned icon buttons (Calendar/Notes/Canvas/Files/Meets) float over the Quill toolbar (held apart by a `padding-right: clamp(8.5rem,34vw,12rem)` hack in globals.css) plus 6 more controls in the bottom row, with a z-index ladder of 4/5/6

**Why**: ~11 always-visible icon-only options around a small text box violates ≤4 options per decision point; on narrow widths the clamp hack and overlay collide with toolbar buttons

**Fix**: Collapse Calendar/Notes/Canvas/Files/Meets behind a single '+' attach menu (Slack pattern) in the bottom row; delete the absolute overlay and the CSS padding hack
**Files**: src/components/messaging/editor.tsx, src/components/messaging/chat-input.tsx, src/app/globals.css

## Persona Red Flags

- Alex (impatient power user): typing 'Ship it!' in editor.tsx opens the Add Calendar Event modal and breaks flow; cannot ArrowDown+Enter a mention — must mouse or Tab through every member row; focus is stolen from the editor into mention-picker's search input 100ms after typing '@'
- Sam (screen-reader/keyboard-only): mention-picker.tsx:120-123 and channel-picker.tsx:83-87 use role='presentation' + onKeyDown stopPropagation, making the pickers invisible/inoperable to AT; label-input.tsx suggestion rows and member-selector.tsx member rows are clickable <div>s with no tabIndex/role; badge-remove X icons are not buttons; thumbnail.tsx DialogContent has no DialogTitle so the lightbox announces nothing; calendar-picker.tsx Labels use htmlFor='date-option'/'time' pointing at ids that don't exist; mentions-notification-dialog hides the only close control
- Riley (stress-tester): renderer.tsx deletes 'Today'/'Tomorrow'/date strings from any calendar-tagged message body; the fixed bottom-[120px] picker overlaps the composer once attachments/suggestions grow it taller; editor.tsx fetches 200 messages (contextMessages, numItems: 200) on every composer mount just to derive canvas/file lists; message-list.tsx IntersectionObserver cleanup is returned from a ref callback so it never runs — one leaked observer per render cycle

## Minor Observations

- Magic numbers: z-[9999] (pickers), bottom-[120px] (pickers), mt-[88px] (heroes), max-w-[350px] mx-auto centering inside calendar dialog
- Recap flow triple-feedback: loading toast + success toast + modal all fire for one action (message-list.tsx:91-141)
- Copy casing drift: 'Add Calendar Event' / 'Mention User' / 'Mention Channel' Title Case vs sentence case in sibling tooltips ('Attach file', 'Hide formatting')
- editor.tsx isIOS regex includes 'Mac' so all Apple devices see 'Return' — variable name lies; harmless but confusing
- contextMessages (200 messages) queried on every composer mount solely to derive canvas/file lists — consider a dedicated lightweight query
- message.tsx spreads taskModal state on every keystroke of the task modal fields — fine functionally, but the modal itself duplicates task-create-form patterns owned by the tasks feature
- ChannelHero copy 'This is the very beginning of the...' is fine, but bold <strong>{name}</strong> inside body text plus '#' prefix in the heading double-signals the channel
- navigation-listener.tsx custom window 'navigate' event bus is an invisible architecture seam — document it or replace with direct router usage at call sites
- usetiful-provider.tsx console.warn fires on every mount when token is absent (dev noise)
- ad-blocker-provider pings pagead2.googlesyndication.com on every app load for all users — privacy-adjacent and slow; consider a local bait element instead

## Per-Component Notes

- `src/components/messaging/editor.tsx` — Remove '!' modal trigger; collapse 5 overlay buttons into one '+' menu; send button uses bg-white/bg-primary literals (dark mode relies on the global bg-white hack); Escape handler registered on document with {once:true} inside every TEXT_CHANGE keystroke — leaky; z-[4]/[5]/[6] ladder
- `src/components/pickers/mention-picker.tsx` — Rebuild on cmdk: keyboard nav, caret anchoring, search-as-you-type in the editor; replace bg-white/bg-gray-50/hover:bg-gray-100 with popover/muted tokens; drop bottom-[120px] and z-[9999]; autoFocus attr duplicates the 100ms focus effect
- `src/components/pickers/channel-picker.tsx` — Copy-paste twin of mention-picker — merge both into one generic trigger-picker primitive so fixes land once; same light-only palette and keyboard issues
- `src/components/mentions-notification-dialog.tsx` — Tokenize the blue system to secondary/muted; restore Dialog close button ([&>button]:hidden); Unread tab badge duplicates All; remove per-row border-t separator divs; empty-state 'All caught up!' exclamation is off-voice
- `src/components/messaging/renderer.tsx` — Delete the 30-format date-string stripping; remove console.log on JSON parse failure (fires for every plain-text message); style the 'Error displaying message' fallback with muted-foreground + retry affordance
- `src/components/messaging/message-list.tsx` — IntersectionObserver cleanup returned from ref callback never runs — move to useEffect; dark:bg-[hsl(var(--card))] is literally bg-card (token bypass); dark:hover:bg-slate-700 and dark:text-gray-300 are off-token; recap Sparkles button on every date divider is repeated AI chrome — one entry point would do
- `src/components/3pc/tidio-chat.tsx` — XSS: escape or remove the inline-script interpolation of user name/email; the React effect already does identical identify work — delete the script block
- `src/components/pickers/calendar-picker.tsx` — htmlFor='date-option'/'time' match no ids — broken label association; native <select> breaks form-control vocabulary (use shadcn Select); 'Loading time options...' state is unreachable (options computed synchronously); 'Add Calendar Event' Title Case vs sentence case elsewhere
- `src/components/pickers/label-input.tsx` — Suggestion rows are divs — make them buttons with aria-activedescendant listbox semantics; X in Badge is an icon with onClick, not a button; onBlur 200ms setTimeout race; bg-white dropdown is light-only
- `src/components/pickers/member-selector.tsx` — Member rows are clickable divs — no keyboard path or role; role='combobox' on trigger lacks aria-controls/aria-haspopup wiring; badge X icons need to be buttons; selected members rendered twice (trigger + footer) is redundant chrome
- `src/components/messaging/thumbnail.tsx` — Add DialogTitle (visually hidden) for AT; fill Image inside a parent with no height — verify it isn't collapsing; alt text is generic 'Thumbnail preview' instead of file name/caption
- `src/components/limit-indicator.tsx` — Remove animate-pulse (perpetual decorative motion, reads as a growth-hack nag); use destructive token instead of red-500 literals
- `src/components/messaging/reactions.tsx` — Drop hover:scale-105 and group-hover:rotate-12 (decorative motion ban); reaction pills h-6 vs add-button h-7 mismatch; slate-200/slate-800 literals instead of muted tokens
- `src/components/hint.tsx` — bg-black text-white border-white/5 hard-coded — use popover tokens so tooltips theme; this styling is duplicated verbatim in emoji-popover.tsx
- `src/components/pickers/emoji-popover.tsx` — Reuse Hint instead of a second inline Tooltip (delayDuration 50 vs 0 drift); emoji-picker-react renders light-only in dark mode — pass its theme prop from the app theme
- `src/components/theme-toggle.tsx` — Default to prefers-color-scheme instead of hard 'light'; null initial theme flashes the wrong icon; the /home pathname special-case belongs in the route, not the toggle
- `src/components/messaging/channel-hero.tsx` — mt-[88px] magic number; text-slate-800 dark:text-slate-400 disagrees with conversation-hero's dark:text-slate-300 — tokenize both to muted-foreground
- `src/components/messaging/conversation-hero.tsx` — Same slate literal drift as channel-hero; gap-x-1 plus mr-2 on Avatar double-spaces the row
- `src/components/messaging/thread-bar.tsx` — Receives count/image/name/timestamp but renders only 'Show thread' — restore '3 replies · last reply 2h ago' info scent (Slack convention users expect)
- `src/components/messaging/chat-input.tsx` — Limit banner uses red-500 literals — destructive tokens; UploadRecordingButton sits ungrouped in its own row; 'Failed to send message.' toast should offer retry since the draft is preserved
- `src/components/3pc/notifications/push-notification-prompt.tsx` — green/orange/red literals over semantic tokens; 'Push notifications are enabled!' exclamation + 40-word sentence — brand voice says say it and stop
- `src/components/3pc/notifications/onesignal.tsx` — Emoji-decorated logger calls and `any` types ship to prod; two hand-rolled 100ms polling loops (waitForOneSignal, login wait) — use the SDK ready callback
- `src/components/messaging/message.tsx` — Context-menu outside-click uses document listener behind a 100ms setTimeout — race-prone; prefer Radix ContextMenu which handles dismissal
- `src/app/globals.css` — Dead .dark .chat-send-button rules target a class no component renders; glass-effect/hover-rotate/animate-float utilities are ban-listed decoration waiting to be used — delete them
- `src/components/pickers/issue-picker-popover.tsx` — Reference implementation for the other pickers; only nit: disabled 'Add' with no count could read 'Add 0' semantics — fine as is

## Questions to Consider

- Is the '!' end-of-text calendar trigger intentional shipped behavior or a leftover experiment? It fires on any exclamation-terminated sentence.
- Is the mention picker's search-below-results layout deliberate (the code comment celebrates it) or inherited from a tutorial? Every category reference (Slack, Linear, Notion) puts input above results at the caret.
- Which surfaces still depend on the global `.dark [class*="bg-white"]` override — is there an inventory, so it can be retired after the pickers/dialog are tokenized?
- Is blue the intended semantic color for notifications, or should unread/notification accents move to the pink secondary token like the rest of the product?
- ThreadBar receives count/name/timestamp but shows none — was the metadata removed intentionally for density, or lost in a refactor?
