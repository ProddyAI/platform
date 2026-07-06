---
target: Meetings & Live (video, audio, presence)
total_score: 22
p0_count: 1
p1_count: 5
timestamp: 2026-07-06T14-48-45Z
slug: src-features-live
---
# Critique — Meetings & Live (video, audio, presence)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/live, src/features/audio, src/features/presence

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 3 | Good: listening dot, upload step labels, autosave status, connecting states. But speaker mute is a global document.querySelectorAll('audio') hack that can desync from actual playback (audio-toolbar-button.tsx), and recor |
| 2 | Match between system and real world | 3 | Mostly plain verbs. 'Executive Summary' is corporate-speak for a small-team tool; 'Push to Tasks' toast says 'pushed N tasks to dashboard!' which names a surface that isn't where tasks live. |
| 3 | User control & freedom | 2 | Retry on audio error runs window.location.reload(), destroying canvas/note state (stream-audio-room.tsx:142); upload errors auto-clear after 5s; sidebar delete fires with no confirm in this surface; recording auto-starts |
| 4 | Consistency & standards | 1 | Foreign hard-coded dark theme panel in a token-driven app; two unrelated designs for identical mic/speaker controls (audio-control-button vs notes-audio-controls); hand-rolled modal instead of the app's Dialog; gradient  |
| 5 | Error prevention | 2 | File type/size validated, schedule requires date+time — good. But 'Meeting scheduled successfully!' fires even when nothing is created anywhere (start-meeting-modal.tsx:114), a global Enter keydown confirms leaving the r |
| 6 | Recognition over recall | 3 | Labels and tooltips broadly present. Icon-only AudioControlButton relies on title attr with no aria-label; 'Push to Tasks' pushes from generations[last] while the list shown comes from meetingNotes — what you see may not |
| 7 | Flexibility & efficiency of use | 2 | Enter/Escape handled on rename, title edit, and dialog. No M-key mute shortcut in an audio room (industry standard), no way to mute from keyboard without tabbing to the floating cluster. |
| 8 | Aesthetic & minimalist design | 2 | Presence/live files are appropriately quiet. Meeting panel stacks 3 differently-colored buttons in its status strip plus a fourth inside a tab; waveform is a decorative indigo-purple gradient in a glass pill (voice-wavef |
| 9 | Help users recognize, diagnose, recover from errors | 2 | WS-error card is genuinely good (cause + Retry + Continue Without Audio + context). But mic-permission-denied is a dead end: the button is disabled so its toast onClick can never fire, and no re-enable instructions are g |
| 10 | Help & documentation | 2 | Empty states teach the next action ('Unmute your microphone to start capturing…'). Nothing beyond that — acceptable for the register, but permission recovery and scheduling behavior are unexplained. |
| **Total** | | **22/40** | |

## Anti-Patterns Verdict

Split verdict. The presence and live-collaboration primitives (presence-indicator, live-participants, liveblocks-room, live-header, live-sidebar list interactions) read as competent, restrained product UI a Linear/Notion-fluent user would trust. But the meeting surfaces betray it: meeting-notes-panel.tsx is a hard-coded Slack-dark clone (#1A1D21/#2B2D31 hexes, gray-300/400 text) dropped into a purple/pink-token light app, with four competing CTAs in indigo, green, and two emeralds; the sidebar's AI button is the canonical indigo-to-purple gradient + Brain icon "AI is magic" cliché PRODUCT.md explicitly bans; the leave-audio dialog is a hand-rolled div modal; and the same mic/speaker controls ship in two visually unrelated designs. A fluent user would trust the workspace chrome and pause hard the moment a meeting starts — the module feels like two products bolted together, which is exactly what Proddy promises not to be.

**Deterministic scan**: 2 findings — ai-color-palette ×2.

## Cognitive Load

- One decision at a time — FAIL: meeting-notes-panel status strip shows up to three stacked colored CTAs (Insert into Note / Generate / Save to Workspace Note Library) plus Push to Tasks inside the tab; four competing 'primary' actions in three colors with no hierarchy (meeting-notes-panel.tsx:159-204, 333)
- Visual grouping — FAIL: 'Save to Workspace Note Library' lives in the header status strip, physically detached from the Summary content it saves; 'Push to Tasks' is buried inside the Action Items tab while its sibling actions are in the header
- No working-memory bridges — FAIL: upload-recording-button auto-clears the error state after 5 seconds and the detailed message only ever appears in a transient toast (_errorMsg is stored but never rendered), so the user must remember what failed and why (upload-recording-button.tsx:119-123)
- ≤4 visible options per decision point — MARGINAL: live-header right cluster can show New/Save/Share/Export/Fullscreen/participants simultaneously (6 controls); standard toolbar shape, but Share/Export deserve an overflow menu at this density (live-header.tsx:238-295)
- Single focus — MARGINAL: when notes panel is open, the floating cluster stacks a 400px panel + control card over the working canvas, competing with the primary task; remaining items (chunking, hierarchy, progressive disclosure) pass

## What's Working

- upload-recording-button.tsx: honest multi-step state machine (transcribing → saving → generating → done) with per-step labels and success/error visual states on the button itself
- stream-audio-room.tsx WS-error card: names the likely cause (network/firewall), offers Retry AND Continue Without Audio, plus a context line — a model error-recovery pattern
- Empty states teach the interface: 'Unmute your microphone to start capturing the conversation', 'Click Generate AI Notes to analyze the transcript' (meeting-notes-panel.tsx)
- live-sidebar.tsx list interactions are solid: inline rename with Enter/Escape, search across title/content/tags, keyboard-activatable rows (role=button, tabIndex, onKeyDown)
- presence-indicator.tsx: clear four-state vocabulary with tooltips and a genuine 'hidden' privacy state that renders nothing
- Leave-audio confirmation with disabled-while-leaving state prevents accidental drops; Escape/Enter both handled
- liveblocks-room.tsx loading copy is calm and plain ('Connecting to live session…'), no hype

## Priority Issues

### [P0] 'Schedule Meeting' can succeed while creating nothing. With no members selected and no channel/conversation, handleStartMeeting skips createMessage entirely yet still toasts 'Meeting scheduled successfully!' and closes the modal. Even in the best case it only posts a chat message — no calendar entry, no reminder (the code comments admit 'for now we'll just send a message').

**Why**: Users believe a meeting exists; it silently doesn't. For a team that replaced their calendar tool with Proddy this is a missed-meeting factory and a direct trust breach ('calm under load' means never lying about state).

**Fix**: Either wire schedule to a real planning/calendar mutation and confirm with the actual date ('Scheduled for Jul 8, 2:00 PM'), or remove the Schedule tab until it exists. Disable the CTA when nothing would be sent, and show the invited-member count on the button.
**Files**: src/features/audio/components/start-meeting-modal.tsx

### [P1] Sidebar item actions are unreachable by keyboard: the rename/delete dropdown only renders when hoveredItemId === item._id, which is set exclusively by onMouseEnter (live-sidebar.tsx:401, 342).

**Why**: Keyboard-only and screen-reader users can never rename or delete a note/canvas from this surface — 'keyboard paths non-negotiable' per PRODUCT.md.

**Fix**: Render the DropdownMenu for every row and control visibility with CSS (opacity-0 group-hover:opacity-100 focus-visible:opacity-100 group-focus-within:opacity-100), not React state.
**Files**: src/features/live/components/live-sidebar.tsx

### [P1] MeetingNotesPanel is a hard-coded foreign dark theme: #1A1D21/#2B2D31/#1E2125/#3A3D42 surfaces, gray-300/400/500 text, and four primary-looking CTAs in indigo-600, green-600, emerald-600, emerald-600 — none of it touching the app's tokens, ignoring light/dark mode entirely.

**Why**: Breaks 'one system' at the exact moment Proddy should feel unified (a meeting inside the workspace). Users see a Slack-dark widget floating over a purple/pink light app; three shades of green/indigo compete for 'the' primary action.

**Fix**: Rebuild on card/popover/muted/border tokens so the panel follows the theme; one primary CTA (Generate/Regenerate) using bg-primary, everything else ghost/outline; drop the Sparkles icon and per-button color overrides.
**Files**: src/features/audio/components/meeting-notes-panel.tsx

### [P1] Hand-rolled leave-confirmation modal: a raw fixed-inset div with no role='dialog', no aria-modal, no focus trap, and a document-level keydown where Enter confirms leaving (stream-audio-room.tsx:271-301, 124-137).

**Why**: Register explicitly bans non-standard modals; screen readers never learn a dialog opened, focus stays behind the overlay, and a stray Enter anywhere on the page ejects the user from the call.

**Fix**: Replace with the app's AlertDialog primitive (Radix gives semantics, focus trap, and key handling for free); make Leave the focused destructive action.
**Files**: src/features/audio/components/stream-audio-room.tsx

### [P1] VoiceWaveform opens its own getUserMedia stream and the cleanup closes the AudioContext but never stops the MediaStream tracks — the mic stays hot after recording stops.

**Why**: The browser's recording indicator stays lit after the user stopped; for a meetings product this reads as 'the app is still listening'. Trust-destroying, and it duplicates the call's existing mic capture.

**Fix**: Keep a ref to the stream and stop all tracks in cleanup; better, analyze the existing call audio track instead of requesting a second one. Also replace the hard-coded #6366f1→#c084fc gradient bars and white/5 glass pill with token colors.
**Files**: src/features/audio/components/voice-waveform.tsx

### [P1] Error Retry executes window.location.reload(), and _retryKey exists but is unused (stream-audio-room.tsx:140-143).

**Why**: Reloading nukes the whole workspace mid-collaboration — unsaved canvas strokes, scroll position, panel state — to fix an audio-only failure. Punishes users for a peripheral subsystem's error.

**Fix**: Use the already-present retryKey to remount/reconnect only the audio room; keep the page alive.
**Files**: src/features/audio/components/stream-audio-room.tsx

### [P2] Mic-permission-denied is a dead end: the fallback button is disabled, so its onClick toast can never fire, and neither variant tells the user how to re-grant permission (audio-toolbar-button.tsx:181-188; notes-audio-controls.tsx:129-146).

**Why**: Denying mic permission is common on first join; users get a red icon with no path back except knowing browser internals.

**Fix**: Keep the button enabled; on click show a popover with re-enable steps (site permissions) and a re-check button that re-runs getUserMedia.
**Files**: src/features/audio/components/audio-toolbar-button.tsx, src/features/audio/components/notes-audio-controls.tsx

## Persona Red Flags

- Sam (screen-reader/keyboard): cannot ever reach Rename/Delete in live-sidebar (hover-state-gated dropdown, line 401); leave dialog in stream-audio-room has no role/aria-modal/focus-trap; AudioControlButton icon-only buttons expose only a title attr — no aria-label, no aria-pressed for mute state; upload-recording-button's real control is an opacity-0 file input so the focus ring is invisible; VoiceWaveform canvas has no accessible name
- Alex (impatient power user): no M-key mute shortcut anywhere in the audio room; notes-audio-controls toasts 'Microphone muted'/'Speaker unmuted' on every single toggle (pure noise — the icon already shows state); Retry reloads the entire page; leave confirmation interrupts even though its own copy admits 'You can rejoin at any time'
- Casey (distracted mobile): MeetingNotesPanel is a fixed w-[400px] in an h-[500px] wrapper floating at bottom-right — overflows any phone viewport and there is no responsive fallback; the fixed bottom-4 right-4 audio cluster ignores the app's own .mobile-footer-safe safe-area pattern; start-meeting-modal member rows use hover:bg-gray-100 with no touch feedback

## Minor Observations

- Exclamation-mark toasts throughout violate brand voice ('Meeting scheduled successfully!', 'Notes saved to your workspace library!', 'Upload complete! AI notes generated and saved.', 'Successfully pushed N tasks to dashboard!') — PRODUCT.md: 'Exclamation marks are rare'
- Default AI note title 'AI Meeting Notes - 7/6/2026' with icon '✨' and tags ['AI','Meeting'] is template-y; derive from meeting/channel name
- Dead identifiers across the module signal unfinished passes: _retryKey, _setIsLeaving, _hasAudio, _router, _user, _errorMsg, _userName, _realName, _currentUser, _currentMember
- meeting-notes-panel transcript is one undifferentiated font-mono paragraph — no speaker turns or timestamps, unreadable for a 45-minute meeting
- start-meeting-modal opens the meeting via window.open target _blank — a popup blocker silently eats the meeting with no fallback link
- sessionIdRef uses Math.random() string concat for session identity (workspace-presence-tracker.tsx:21) — fine functionally, but crypto.randomUUID() is already used one file over

## Per-Component Notes

- `src/features/audio/components/meeting-notes-panel.tsx` — Replace all #1A1D21/#2B2D31/#1E2125/#3A3D42 hexes with card/muted/border tokens; one primary CTA, rest ghost; move Save-to-Library next to the Summary it saves; Push to Tasks reads generations[last] while UI shows meetingNotes.actionItems — align source; key={i} on lists; 'Successfully pushed N tasks to dashboard!' → 'Added N tasks'; text-[10px] font-bold label below readable floor
- `src/features/audio/components/stream-audio-room.tsx` — Swap hand-rolled overlay for AlertDialog; use retryKey instead of location.reload; join button green-600 and leave red-500 are off-token (use primary/destructive); w-[400px] notes panel needs a mobile breakpoint; connecting state could show the room name for context
- `src/features/live/components/live-sidebar.tsx` — Fix hover-gated actions (focus-within/CSS visibility); replace indigo→purple gradient 'AI Note' button with a primary-token button — the gradient+Brain combo is the exact 'AI as magic' anti-reference; delete has no confirmation at this level; toLocaleDateString with no locale control
- `src/features/audio/components/start-meeting-modal.tsx` — Schedule branch is a placeholder that lies on success; hover:bg-gray-100 rows break in dark mode (use hover:bg-muted); no empty state when search matches nobody; no loading state while members query resolves; date input allows the past; 'Select All' operates on filtered results without saying so; CTA should show invite count
- `src/features/audio/components/voice-waveform.tsx` — Stop MediaStream tracks on cleanup (mic stays hot); reuse the call's audio track instead of a second getUserMedia; hard-coded indigo/purple gradient bars + bg-white/5 backdrop-blur glass pill are off-token decoration — flat primary-token bars on a muted surface; add aria-label to canvas; honor prefers-reduced-motion by capping frame updates
- `src/features/audio/components/audio-control-button.tsx` — Add aria-label and aria-pressed for mute toggles (title attr alone is unreliable for SRs); bg-gray-100/red-500 → muted/destructive tokens; dead isActive prop; the ternary `variant === "action" ? "h-5 w-5" : "h-5 w-5"` is a no-op; no visible focus ring differentiation on the filled red state
- `src/features/audio/components/notes-audio-controls.tsx` — Near-duplicate of audio-toolbar-button with a different visual design (ghost h-8 + red dot vs filled rounded-full h-10) — same action must look the same everywhere; drop success toasts on every mute toggle; toggleSpeaker shares the fragile global querySelectorAll('audio') approach without the MutationObserver the other copy has (new audio elements ignore mute)
- `src/features/audio/components/audio-toolbar-button.tsx` — Disabled button's onClick toast is unreachable — give denied state an enabled recovery affordance; 'Mic Permission Denied' Title Case vs sentence case elsewhere; MutationObserver-on-body speaker mute belongs in the SDK's device API if available
- `src/features/live/components/live-cursor.tsx` — members[connectionId % members.length] can label a cursor with the WRONG person's name — show 'Someone' instead of guessing; raw connectionId number as fallback name leaks internals; nameWidth = length*12 heuristic breaks on long names (use CSS max-w + truncate); per-cursor Convex members query is wasteful — lift to parent
- `src/features/live/components/live-header.tsx` — Title click-to-edit has no visible affordance (pencil-on-hover); Clock with animate-spin as saving icon is odd — use Loader2; second row renders an empty flex row (stray gap) when tags/search are off; en-US locale hard-coded for dates; Save disabled with no tooltip explaining why; bg-white depends on the global dark-mode override hack
- `src/features/audio/components/upload-recording-button.tsx` — Focus ring invisible (opacity-0 input over pointer-events-none button) — style the button on input:focus-visible via peer; keep error visible until dismissed instead of 5s auto-clear; _errorMsg stored but never rendered; 'Done!' → 'Saved'; 'uploading' step label is dead (flow jumps to transcribing)
- `src/features/live/components/live-cursors-presence.tsx` — Entire useEffect (lines 110-132) is dead debugging code computing names into discarded vars; DrawingPaths duplicates the members query and userMap that are never used for rendering; two `as any` casts defeat the typed Liveblocks config
- `src/features/live/components/live-participants.tsx` — Overflow avatar uses border-gray-300/bg-gray-100 while others use border-muted — tokenize; returning null while loading makes avatars pop in (render skeleton circles); conventional overlap stack (-space-x-2) would read more instantly as 'people here'
- `src/features/presence/components/presence-indicator.tsx` — Idle Moon breaks the shape vocabulary — other states are ringed dots, idle is a borderless floating glyph that blends into avatars; consider ringed yellow dot with moon cutout; status colors are raw palette (acceptable for presence semantics, but standardize as semantic tokens)
- `src/features/live/components/liveblocks-room.tsx` — Solid. Register prefers a skeleton of the destination surface over centered spinner for connect states; 'Initializing workspace…' vs 'Connecting to live session…' distinction is invisible to users — pick one voice
- `src/features/presence/components/workspace-presence-tracker.tsx` — n/a — headless logic, no UI surface; silent heartbeat failure is the right call

## Questions to Consider

- Is delete confirmation for notes/canvas handled by LiveSidebar's parents, or does onDeleteItem destroy immediately? If immediate, the P-list gains an entry.
- Is the Schedule branch of start-meeting-modal known-placeholder (the code comment admits it) and hidden behind a flag in production, or is it live?
- Is MeetingNotesPanel intentionally dark-on-any-theme as a 'meeting mode' decision, or is it inherited from a Slack-style reference? If intentional, it still needs to be built from dark tokens, not hexes.
