---
target: Canvas (Liveblocks collaborative whiteboard)
total_score: 23
p0_count: 0
p1_count: 4
timestamp: 2026-07-06T14-48-44Z
slug: src-features-canvas
---
# Critique — Canvas (Liveblocks collaborative whiteboard)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/canvas

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Persistence is a 250ms debounced write in excalidraw-canvas.tsx with zero UI signal; page.tsx hardcodes autoSaveStatus="saved" and hasUnsavedChanges={false} into LiveHeader — the UI asserts a state it never measures. Leg |
| 2 | Match between system and real world | 3 | Excalidraw gives standard whiteboard vocabulary (good), but "AI Format" names a diagram generator — it formats nothing; brief says verbs over adjectives: "Generate diagram". Emoji 🗒/✨ as tool icons don't match the surrou |
| 3 | User control and freedom | 2 | Auto tool-lock (excalidraw-canvas.tsx:743-775) silently overrides Excalidraw's default single-use tools with no opt-out or indication. Legacy: Clear Canvas wipes all users' work in one click with no confirm and no undo p |
| 4 | Consistency and standards | 1 | Two parallel whiteboard implementations in one feature folder; emoji icons vs lucide vs Excalidraw icons; hard-coded bg-purple-600/text-gray-700 (flowchart-generator.tsx) and text-red-500/hover:bg-red-100 (saved-dropdown |
| 5 | Error prevention | 2 | Destructive actions are inconsistently guarded (page delete has window.confirm, dropdown delete has nothing, clear-canvas has nothing). Global "N" keydown (excalidraw-canvas.tsx:701-716) preventDefaults page-wide while t |
| 6 | Recognition rather than recall | 3 | Tooltips label tools and document the N shortcut (good). But color-picker.tsx has no selected-state on swatches — users must remember the active color; top-toolbar.tsx stroke slider shows no numeric value or label; expor |
| 7 | Flexibility and efficiency of use | 3 | N shortcut, Excalidraw's native shortcut set, Ctrl+Enter in flowchart dialog, tool auto-lock for repeated insertion — decent power-user story. AI Format textarea lacks Cmd+Enter submit; legacy canvas never wired Delete/B |
| 8 | Aesthetic and minimalist design | 2 | Live surface is clean because Excalidraw is. Proddy's additions clutter: fallback emoji tool buttons injected into the top-right presence cluster (tools mixed with identity), and the legacy left rail is four disconnected |
| 9 | Help users recognize, diagnose, recover from errors | 2 | Mermaid layer renders an in-place error card with the message (good). But export-canvas-dialog.tsx paints "Failed to render canvas" INTO the exported PNG and resolves it as success — the failure ships as the artifact; AI |
| 10 | Help and documentation | 3 | Example prompts in flowchart-generator.tsx, a Mermaid syntax example in mermaid-edit-dialog.tsx, concrete placeholder in the AI Format textarea, shortcut in tooltip — genuinely helpful. Nothing teaches the canvas itself  |
| **Total** | | **23/40** | |

## Anti-Patterns Verdict

Split verdict. The live surface — ExcalidrawCanvas — mostly passes the product slop test by borrowing Excalidraw's earned familiarity wholesale: a Figma/Miro-fluent user would sit down and draw without pausing. But every seam where Proddy touches that surface reads as unfinished: emoji glyphs (🗒 ✨) portaled into a line-icon toolbar via brittle DOM polling, a vaguely named "AI Format" sidebar with an unstyled, focus-invisible textarea, a bare "Loading canvas…" string instead of a skeleton, and a header that permanently claims "saved" while persistence is a fire-and-forget 250ms debounce. Worse, the module ships an entire abandoned second whiteboard (19 of 21 files) whose chrome would fail the trust test hard — native alert() for a destructive multi-user "clear canvas", fabricated success toasts (setTimeout-then-toast.success with no awaited work), a JSON "export" that contains no canvas data, and active tool states visually identical to inactive ones because both resolve to the same pink bg-secondary. A user never sees most of that, but a design director must: it is unowned surface area that contradicts "one system" and will leak back into the product the first time someone imports from it.

**Deterministic scan**: 0 findings.

## Cognitive Load

- Visual grouping: legacy left rail is four separate floating white cards (colors, undo/redo, AI flowchart, clear) with no shared container or labels, anchored at an arbitrary top-[55%] (toolbar.tsx:116-169).
- One decision at a time: export-canvas-dialog.tsx presents two tabs ('Export to Chat' / 'Download') whose contents are pixel-identical PNG/SVG/JSON pickers (lines 608-684) — the same decision rendered twice, with the actual difference hidden in the footer button.
- No working-memory bridges: color-picker.tsx shows no selected state on any swatch and top-toolbar.tsx's stroke slider shows no numeric value — the user must remember the active color and width across mode switches.
- ≤4 visible options per decision point: the legacy chrome offers five overlapping 'keep my work' concepts at once — rename, save, quick-save, export-to-chat, download, plus a saved-canvases dropdown (canvas-name.tsx:198-265).
- Single focus: when the toolbar portal fails, sticky-note and AI tool buttons render inside the top-right presence/avatar cluster (excalidraw-canvas.tsx:1043-1084), mixing tools with identity in one visual group.
- Clear hierarchy (pass, worth noting): stroke slider appearing only in pen mode and the AI sidebar being collapsed by default are good progressive disclosure — the live surface's cognitive load is otherwise carried competently by Excalidraw.

## What's Working

- Building on Excalidraw is the right register call: earned familiarity, standard whiteboard affordances, dense and fast — the tool disappears into the task exactly as PRODUCT.md asks.
- Theme integration done properly on the live surface: MutationObserver on the .dark class drives Excalidraw's theme prop (excalidraw-canvas.tsx:447-462) instead of a hard-coded light mode.
- Sticky-note object integrity shows real care: shadow element tracks the note, group-entry and shadow-only selection are actively redirected to the parent note so the composite behaves as one object (excalidraw-canvas.tsx:783-937).
- Deliberate presence decision documented in code: Excalidraw's collaborator avatars are suppressed in favor of a single LiveParticipants source of truth (excalidraw-canvas.tsx:517-524), avoiding duplicated presence UI.
- Page-level empty state teaches and has one clear CTA with a real loading state ("Create a new canvas to start drawing and collaborating").
- Defensive rendering: DOMPurify sanitization of Mermaid SVG (mermaid.tsx:57-110), NaN guards in path.tsx, sanitizeAppState stripping the non-serializable collaborators map.
- Low-latency collaboration design: incremental excalidraw:delta broadcasts layered over debounced snapshot persistence is the right split for perceived speed.

## Priority Issues

### [P1] 19 of 21 components in src/features/canvas are dead code — an entire abandoned Liveblocks whiteboard (canvas.tsx, toolbar.tsx, top-toolbar.tsx, canvas-name.tsx, all layer components, all dialogs) with no importers outside the feature; only excalidraw-canvas.tsx and path.tsx are live.

**Why**: It contradicts 'one system' at the source level: two visual grammars, two save models, two icon sets for the same feature. It carries banned patterns (alert(), fake success toasts, lying JSON export) that will leak back in via copy-paste, it inflates the bundle surface, and it makes every review of this module — including automated ones like CodeRabbit/DeepSource — waste effort on unreachable UI.

**Fix**: Decide the direction explicitly: if Excalidraw is the committed canvas, delete the legacy tree (keep path.tsx, which live-cursors-presence uses, or move it into features/live). If the legacy canvas is still needed for embedded message previews, quarantine it under a legacy/ folder and file the P1s below against it.
**Files**: src/features/canvas/components/canvas.tsx, src/features/canvas/components/toolbar.tsx, src/features/canvas/components/top-toolbar.tsx, src/features/canvas/components/canvas-name.tsx, src/features/canvas/components/export-canvas-dialog.tsx, src/features/canvas/components/saved-dropdown.tsx, src/features/canvas/components/flowchart-generator.tsx, src/features/canvas/components/mermaid.tsx

### [P1] Save status is fabricated on the live canvas: excalidraw-canvas.tsx persists via a 250ms debounce with no exposed state, while the page hardcodes autoSaveStatus="saved" and hasUnsavedChanges={false} into LiveHeader.

**Why**: The header permanently asserts 'saved'. A user who draws and immediately closes the tab (or loses connection) silently loses the last strokes while the UI told them everything was persisted — a direct violation of visibility of system status and the brief's 'calm under load' honesty.

**Fix**: Have ExcalidrawCanvas expose a real status (pending during the debounce window/broadcast, saved after persistScene commits, error on failure) via callback or context, and feed it to LiveHeader. Flush the pending debounce on beforeunload/visibilitychange.
**Files**: src/features/canvas/components/excalidraw-canvas.tsx, src/app/workspace/[workspaceId]/channel/[channelId]/canvas/page.tsx

### [P1] Proddy's two custom tools are emoji buttons (🗒, ✨) portaled into Excalidraw's toolbar via a 25-attempt DOM-polling hack against internal class names (.shapes-section), with a fallback that dumps the same buttons into the top-right presence cluster.

**Why**: Emoji render differently per OS and clash with the line-icon vocabulary of every adjacent tool — the exact 'inconsistent component vocabulary' the register bans, and ✨ is 'AI dressed up as magic' per the brief's anti-references. The polling is fragile: any Excalidraw upgrade renames the class, and for up to ~3s (or forever, on failure) the tools either vanish or appear mixed in with identity/presence UI.

**Fix**: Replace emoji spans with lucide StickyNote and a non-sparkle diagram icon sized to match Excalidraw's ToolIcon SVGs. Prefer Excalidraw's supported extension points (renderTopRightUI or a custom footer/Sidebar trigger) over class-name portals; if the portal stays, use a MutationObserver instead of timed polling and keep exactly one placement, never two.
**Files**: src/features/canvas/components/excalidraw-canvas.tsx

### [P1] The 'AI Format' sidebar is under-designed: misnamed feature, raw textarea with outline-none and no focus ring, no associated label, no inline error state, no Cmd+Enter, no way to cancel generation.

**Why**: This is the module's only novel (non-Excalidraw) interaction and the one place Proddy's AI promise is on display. A keyboard user literally cannot see focus in it (outline-none with no ring contradicts 'accessible by default'); errors vanish into toasts; 'AI Format' tells an operator nothing about what the button does.

**Fix**: Rename to 'Generate diagram'. Add a visible <label>, focus-visible ring (ring token), inline error text under the textarea on failure with the prompt preserved, Cmd+Enter to submit, and a disabled-with-reason state for empty prompts instead of a post-click toast.
**Files**: src/features/canvas/components/excalidraw-canvas.tsx

### [P2] Global 'N' shortcut (window keydown, preventDefault) hijacks the key across the whole page whenever the canvas route is mounted, guarded only against INPUT/TEXTAREA/contentEditable targets.

**Why**: Focus on any button, menu, or dialog in the sidebar/header still triggers sticky-note insertion and swallows the keypress; it also silently collides with any future app-level shortcut. Impatient users typing fast around the UI will spawn notes they didn't ask for.

**Fix**: Scope the listener to the Excalidraw host element (or check that document.activeElement is inside excalidrawHostRef) and don't preventDefault when a Radix overlay/dialog is open.
**Files**: src/features/canvas/components/excalidraw-canvas.tsx

### [P2] Loading state for the dynamically imported Excalidraw is a bare <div className="p-4">Loading canvas…</div>.

**Why**: First paint of the feature is an unstyled text string — the register explicitly calls for skeletons over placeholder text/spinners in content, and this is the one guaranteed-visible loading moment of the whole module.

**Fix**: Render a canvas-shaped skeleton: neutral surface with shimmering toolbar and left-rail placeholder blocks using the muted token, matching the eventual layout so nothing jumps.
**Files**: src/features/canvas/components/excalidraw-canvas.tsx

### [P2] Legacy chrome fabricates outcomes: canvas-name.tsx quick-save shows toast.loading then an unconditional toast.success after 500ms with no awaited operation (and the loading toast never resolves); export-canvas-dialog.tsx 'JSON' export downloads a file containing only {canvasName, exportTime, roomId} — none of the drawing — and reports success.

**Why**: Both lie to the user about the fate of their work. Even as currently-unreachable code, these are trust-destroying patterns one import away from production; if the legacy canvas is ever re-enabled, they become P0s.

**Fix**: If the legacy tree survives the P1 triage: make quick-save await a real persistence call and update the same toast id; make JSON export serialize actual Liveblocks storage (layers/layerIds) or remove the JSON option.
**Files**: src/features/canvas/components/canvas-name.tsx, src/features/canvas/components/export-canvas-dialog.tsx

## Persona Red Flags

- Alex (impatient power user): draws, sees LiveHeader say 'saved' (hardcoded in page.tsx:376-377), closes the tab inside the 250ms debounce window of excalidraw-canvas.tsx:970-985 and loses strokes with zero warning; also cannot cancel a running diagram generation — the Generate button just disables (excalidraw-canvas.tsx:1129-1134).
- Alex (legacy surface): selects a shape and presses Delete — nothing happens; useDeleteLayers is imported but never wired (canvas.tsx:361, keydown handler at 363-384 only handles ctrl+z).
- Sam (keyboard/screen-reader): the AI Format textarea (excalidraw-canvas.tsx:1123-1128) has outline-none, no focus ring, and no <label> — focus is invisible and the field is announced only by placeholder; legacy color-picker.tsx buttons (lines 36-49) have no aria-label, so a screen reader hears eight identical unnamed buttons; the portaled emoji buttons inherit focus styling from Excalidraw's .ToolIcon classes, which is unverified and outside Proddy's control.
- Riley (stress-tester): mashes N — each sticky note fires an animated scrollToContent (excalidraw-canvas.tsx:691-697) yanking the viewport repeatedly with no reduced-motion check; in the legacy dropdown, one click on the per-canvas 'Delete' row (saved-dropdown.tsx:177-192) irreversibly deletes the message AND the Liveblocks room with no confirmation; the export capture picks whichever SVG in the entire document has the most children (export-canvas-dialog.tsx:59-119), so with an icon-heavy sidebar open Riley exports the wrong element as their canvas.

## Minor Observations

- Clear Canvas success/failure uses native alert() (toolbar.tsx:107-109) — banned non-standard-modal-adjacent pattern in a product that has shadcn dialogs and sonner.
- Active vs inactive tool states are visually identical: ToolButton maps active→variant 'secondary' and idle→'default', and button.tsx styles both as bg-secondary pink; idle tools also violate 'no full-saturation accents on inactive states' (tool-button.tsx:26-33).
- Hard-coded palette values instead of tokens: bg-purple-600/hover:bg-purple-700/text-purple-600/text-gray-700/text-gray-500 (flowchart-generator.tsx:117,125,139,146,175), text-red-500/hover:text-red-700/hover:bg-red-100 (saved-dropdown.tsx:178), #f9f9f9/#fee2e2/gray-scale inlines (mermaid.tsx).
- Toast copy breaks brand voice: 'Flowchart generated successfully!' (flowchart-generator.tsx:78) — exclamation plus filler adverb; brief says say what happened, then stop ('Flowchart added').
- canvas.tsx renders fake selection presence: selections is a hard-coded mock ([1,['layer1','layer2']]...) at lines 299-304, so collaborator selection colors are fiction.
- Legacy empty-state message is SVG text at x='50%' inside the camera-translated <g> (canvas.tsx:472-485) — it pans away with the camera and isn't actually centered.
- note.tsx and text.tsx feed layer values straight into react-contenteditable's html prop — collaborator-supplied HTML rendered unsanitized (XSS vector if this code is ever revived), and the fallback string 'Text' is real content, not a placeholder.
- toast.loading calls in canvas-name.tsx (lines 118, 143) and saved-dropdown.tsx (line 92) are never dismissed or updated by id, so loading toasts stack on top of success toasts.
- mermaid.tsx renders a spinner inside the diagram tile ('Rendering diagram…') — register prescribes skeletons over spinners in content.
- Sticky note colors are fixed light-mode values (#fff3bf paper, #1f1f1f text, excalidraw-canvas.tsx:590-593) — verify Excalidraw's dark-theme filter keeps them legible rather than relying on it.
- Snapshot versioning uses wall-clock Date.now()*1000 plus random jitter (excalidraw-canvas.tsx:971-977) — a clock-skewed client permanently wins last-writer-wins; a Liveblocks-side counter would be safer.
- top-toolbar.tsx renders no zoom control and use-camera.ts supports pan only — the legacy canvas has no zoom at all, while Excalidraw does; another consistency gap between the two implementations.

## Per-Component Notes

- `src/features/canvas/components/excalidraw-canvas.tsx` — The only live component and it needs one focused pass: lucide icons instead of 🗒/✨, rename 'AI Format' → 'Generate diagram', label + focus ring + inline error on the sidebar textarea, skeleton for the dynamic-import loading state, scope the N shortcut to the canvas host, respect prefers-reduced-motion on scrollToContent, and surface real save status upward.
- `src/features/canvas/components/canvas.tsx` — Dead code; if revived: wire useDeleteLayers to Delete/Backspace, add Escape-to-deselect, remove the mocked selections array, and fix the empty-state text so it doesn't pan with the camera.
- `src/features/canvas/components/toolbar.tsx` — Dead code; if revived: replace alert() with a confirm dialog + toast, gate Clear Canvas behind confirmation (it's destructive for every collaborator), and merge the four floating cards into one grouped rail.
- `src/features/canvas/components/tool-button.tsx` — Active and inactive both resolve to pink bg-secondary — make idle tools ghost/neutral and reserve the accent for the single active tool, per the register's inactive-state rule.
- `src/features/canvas/components/canvas-name.tsx` — Quick-save and new-canvas flows fabricate progress with setTimeout toasts that never resolve the loading toast; await real operations and update toasts by id. Five persistence affordances in one 40px pill need consolidation.
- `src/features/canvas/components/export-canvas-dialog.tsx` — JSON export omits the actual drawing; capture heuristic greps the whole document for the biggest SVG; identical tab contents. If kept: serialize real storage, scope capture to a data-canvas ref, and collapse the tabs into one format picker + destination radio.
- `src/features/canvas/components/saved-dropdown.tsx` — Per-canvas 'Delete' rendered as a sibling full-width menu row with no confirmation and hard-coded red utilities — move destructive action into a per-item context menu with a confirm step and destructive tokens.
- `src/features/canvas/components/flowchart-generator.tsx` — Swap bg-purple-600/text-gray-* hard-codes for primary/muted-foreground tokens; drop the exclamation from the success toast; example-prompt chips are a good pattern worth carrying into the live AI sidebar.
- `src/features/canvas/components/color-picker.tsx` — Add aria-label per swatch (color names) and a visible selected state (ring); the white swatch needs its border verified against the white card in dark mode.
- `src/features/canvas/components/top-toolbar.tsx` — Stroke slider needs a label and a live numeric value; consider showing current color next to the tools so pen state doesn't rely on memory.
- `src/features/canvas/components/mermaid.tsx` — Replace spinner-in-tile with a neutral skeleton block; tokenize the gray/red inline colors; the in-place error card with message + double-click-to-edit recovery is the right shape — keep it.
- `src/features/canvas/components/text.tsx` — Unsanitized html into ContentEditable (sanitize like mermaid.tsx does), drag via document listeners + setTimeout(0) is fragile; cursor grab/grabbing/text states are good.
- `src/features/canvas/components/note.tsx` — Default fill #000 makes an unreadable black sticky; sanitize the html prop; 'Text' fallback should be a placeholder style, not content.
- `src/features/canvas/components/mermaid-edit-dialog.tsx` — Solid dialog (example block, validation, disabled save) — minor: text-red-600 should be text-destructive, and validation message shows only after the user empties the field.
- `src/features/canvas/components/save-canvas-dialog.tsx` — Three dead underscore-prefixed hooks (_router, _workspaceId, _createMessage) signal abandoned wiring; the Input lacks an associated label element.
- `src/features/canvas/components/selection-box.tsx` — Eight resize handles are 8px targets with correct per-corner cursors but no touch-size affordance; handle color is hard-coded blue-500 rather than the ring/selection token used elsewhere.
- `src/features/canvas/components/new-canvas-dialog.tsx` — Correct confirm-before-destroy pattern the rest of the legacy chrome lacks; the confirm button should arguably be destructive-styled since it discards unsaved work.
- `src/features/canvas/components/layer-preview.tsx` — Fine as a dispatcher; the `layer as any` casts on every branch defeat the typed Layer union in types.ts.
- `src/features/canvas/components/path.tsx` — Still live via live-cursors-presence — the NaN guards are good; consider relocating it to features/live if the legacy canvas is deleted.
- `src/features/canvas/components/rectangle.tsx` — Default fill #000 and drop-shadow-md on every shape; selection stroke 'transparent' means no hover affordance before selection.
- `src/features/canvas/components/ellipse.tsx` — Same notes as rectangle.tsx: black default fill, no hover state, shadow as permanent decoration.

## Questions to Consider

- Is the legacy Liveblocks whiteboard (canvas.tsx and its 18 supporting components) intentionally retained — e.g., for canvas previews embedded in chat messages — or is ExcalidrawCanvas the committed direction and the rest deletable?
- Has the sticky note's fixed light-paper palette (#fff3bf / #1f1f1f) been checked under Excalidraw's dark theme, or is it relying on Excalidraw's scene-inversion filter?
- Is 'AI Format' the settled name for diagram generation, or can it align with the verb-first voice ('Generate diagram') used elsewhere in Proddy?
- Should canvas save-state be surfaced through LiveHeader's existing autoSaveStatus contract (currently hardcoded to 'saved'), or is a dedicated in-canvas indicator preferred?
