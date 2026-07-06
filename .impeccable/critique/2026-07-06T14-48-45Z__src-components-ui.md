---
target: UI primitives (shadcn/Radix layer)
total_score: 19
p0_count: 0
p1_count: 3
timestamp: 2026-07-06T14-48-45Z
slug: src-components-ui
---
# Critique — UI primitives (shadcn/Radix layer)

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/components/ui

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | No loading affordance in Button (register requires default/hover/focus/active/disabled/loading); Progress has no indeterminate mode; Slider communicates no value visually (range color == track color); OTP caret never bli |
| 2 | Match between system and real world | 2 | calendar.tsx reinvents a standard date-picker (register bans reinventing standard affordances) and loses month/year jump, outside days, range select; variant naming inverts ecosystem convention (default=pink secondary, p |
| 3 | User control and freedom | 3 | Radix gives Esc/overlay dismiss for dialog/sheet/popover for free; calendar offers no fast month/year navigation and no onMonthChange for controlled use, so parents silently desync. |
| 4 | Consistency and standards | 1 | Three radius vocabularies on sibling overlays (dialog/dropdown rounded-[10px], popover/select rounded-md, dropdown items rounded-[6px] vs rounded-sm in the same file); Input styled with pink hover border + shadows while  |
| 5 | Error prevention | 2 | AlertDialogAction defaults to buttonVariants() — the pink 'default' — so destructive confirmations render as the primary-action color unless every call site remembers to override; Checkbox unchecked state wears a full-sa |
| 6 | Recognition rather than recall | 2 | Icon-only calendar prev/next buttons have no accessible name; developers must recall that 'default' is pink and 'primary' is purple, and that default===secondary — a Proddy-only inversion carried in working memory. |
| 7 | Flexibility and efficiency of use | 3 | asChild, className passthrough, cmdk shortcuts and CommandShortcut/DropdownMenuShortcut are solid; but transition-standard (transition: all, 200ms) on every dropdown item makes fast keyboard traversal feel laggy, and cal |
| 8 | Aesthetic and minimalist design | 2 | shadow-md→shadow-lg on every solid button, hover:shadow-md on every Avatar (false affordance), glass variant, pink gradient Progress fill, backdrop-blur-sm on opaque dialog/dropdown/tooltip surfaces plus dead border-opac |
| 9 | Help users recognize, diagnose, and recover from errors | 1 | No aria-invalid/error styling exists on Input, Textarea, or SelectTrigger — the form layer has literally no error state; Alert destructive text (hsl 0 100% 65%) is 3.3:1 on white, below AA. |
| 10 | Help and documentation | 1 | No JSDoc, no usage notes, no story/spec files; nonstandard divergences (variant inversion, custom Calendar props) are exactly the cases that needed a comment and have none. |
| **Total** | | **19/40** | |

## Anti-Patterns Verdict

A user fluent in Linear/Notion/Figma would mostly trust this surface at first glance — the bones are faithful stock shadcn with Radix underneath, forwardRef/displayName discipline is clean, and focus-visible rings are consistently wired. But within a minute of real use the resprayed-not-redesigned tells stack up: --secondary was remapped from shadcn's 'muted gray' to hot brand pink via find-and-replace without auditing the upstream classes that assumed gray (the Slider's filled range is literally invisible because track and range are both bg-secondary; the Sheet close button goes full pink when open), Button ships two byte-identical pink variants plus a 'primary' variant that inverts shadcn convention, a 'glass' glassmorphism variant sits in the core library against PRODUCT.md's explicit anti-reference, Progress hard-codes a Tailwind-palette pink gradient that isn't even the brand pink, and the Calendar is a hand-rolled replacement for react-day-picker that drops keyboard grid navigation and accessible labels. It reads as an AI-assisted retheme of shadcn rather than a curated system — the failure mode is exactly the register's 'strangeness without purpose', and the primitives layer is the worst place to have it because every module inherits it.

**Deterministic scan**: 0 findings.

## Cognitive Load

- One decision at a time / ≤4 options per decision: Button exposes 9 variants (default, destructive, outline, secondary, primary, ghost, link, transparent, glass) where two are identical and three compete for 'the main action' — every consumer of the library faces a 9-way choice with no correct answer documented (src/components/ui/button.tsx).
- No working-memory bridges: the default/primary inversion (default=brand pink 'secondary' color, primary=purple) is a Proddy-only convention every developer must hold in memory against shadcn muscle memory; Badge repeats the same trap (button.tsx, badge.tsx).
- Visual grouping: side-by-side form controls don't read as one group — Input (10px radius, shadow, pink hover border) vs SelectTrigger (6-8px radius, flat, no hover) breaks the gestalt of any form row (input.tsx vs select.tsx).
- Clear hierarchy: with default Button, secondary Button, Badge default, Checkbox border, Slider track, and Calendar selection all rendered in the same full-saturation pink, the accent no longer marks 'the one primary thing' — hierarchy flattens because everything is loud (button.tsx, badge.tsx, checkbox.tsx, slider.tsx, calendar.tsx).

## What's Working

- Consistent engineering hygiene: forwardRef + displayName on every component, className/cn passthrough everywhere, Radix primitives as the base — the library composes predictably.
- Focus-visible ring treatment (ring-2 ring-ring ring-offset-2) is applied uniformly across button, input, textarea, checkbox, switch, slider, tabs — keyboard focus is never dropped by a primitive.
- Real a11y intent in places: CommandDialog ships VisuallyHidden DialogTitle/Description, dialog/sheet close buttons have sr-only labels, Separator honors decorative, CardTitle exposes a polymorphic `as` prop for correct heading levels.
- Motion tokens (--duration-fast/normal/slow) and shadow/radius tokens exist and are registered in tailwind.config.ts — the infrastructure for discipline is there even where individual components bypass it.
- InputOTPSlot's click-to-position caret handling (setSelectionRange via shared ref context) is a genuinely thoughtful upgrade over stock shadcn.

## Priority Issues

### [P1] Slider's filled range is invisible: Track is bg-secondary and Range is also bg-secondary (slider.tsx lines 20-21), so the whole bar renders as one solid pink pill with no value indication. Upstream shadcn uses bg-secondary (gray) track + bg-primary range; the secondary→pink remap erased the distinction.

**Why**: A slider that shows no fill communicates nothing at rest — users must grab the thumb to discover the value. This is a broken component shipped to every feature that imports it.

**Fix**: Track → bg-muted (or bg-secondary/20 to match Progress), Range → bg-secondary. While there, align Progress and Slider to the same fill color so 'amount' reads identically across the system.
**Files**: src/components/ui/slider.tsx

### [P1] Text-contrast failures baked into the token+primitive combination: white text on --secondary pink (hsl 326 100% 55%) is ~3.6:1 — below AA 4.5:1 — and it is the DEFAULT Button, default Badge, AvatarFallback, and Calendar selected-day treatment. Badge 'warning' is white on bg-yellow-500 (~1.9:1); --destructive (0 100% 65%) with near-white foreground is ~3.3:1.

**Why**: The most-used interactive element in the product (the default button) fails WCAG AA for its label text, and the warning badge is functionally unreadable. 'Accessible by default' is a stated non-negotiable in PRODUCT.md.

**Fix**: Darken --secondary to ≥4.5:1 against white (e.g. drop L toward 45%) or switch default-button/badge foreground pairing; give warning a dark foreground (text-yellow-950 on yellow-400/500); darken --destructive. Add --success/--warning tokens instead of raw green-500/yellow-500 so dark mode can remap them.
**Files**: src/app/globals.css, src/components/ui/button.tsx, src/components/ui/badge.tsx, src/components/ui/avatar.tsx, src/components/ui/calendar.tsx

### [P1] calendar.tsx is a hand-rolled replacement for react-day-picker with major a11y regressions: prev/next month buttons are icon-only with no aria-label; <tr> elements carry className="flex", which destroys table/grid semantics for screen readers; day buttons have no aria-selected/aria-current; there is no roving-tabindex arrow-key grid navigation; and the controlled `month` prop has no onMonthChange, so controlled parents silently desync when the user navigates.

**Why**: Sam (screen-reader/keyboard user) hears 'button, button' for month nav and gets a flat list of 30+ unlabeled tab stops instead of a date grid. The register explicitly bans reinventing standard affordances — this rewrite bought flavor and paid in accessibility.

**Fix**: Restore react-day-picker (upstream shadcn calendar) styled with existing tokens; if the custom implementation must stay, add aria-labels to nav buttons, remove flex from table rows (use a CSS grid with role=grid/gridcell), add aria-selected + arrow-key navigation, and add onMonthChange.
**Files**: src/components/ui/calendar.tsx

### [P2] Button/Badge variant taxonomy is incoherent: Button 'default' and 'secondary' are visually identical pink (only hover 90 vs 80), a 'primary' variant was bolted on for purple, and Badge 'default' and 'secondary' are byte-identical. Nine button variants including 'glass' (glassmorphism — a PRODUCT.md anti-reference) and 'transparent' whose text-accent (hsl 210 40% 96%) is invisible on light backgrounds.

**Why**: The primitives layer is where 'a button is a button everywhere' is enforced. Duplicate/inverted variants guarantee call sites drift (some teams will use default, others secondary, others primary for the same action), and glass/transparent are footguns sitting in the core API.

**Fix**: Collapse to shadcn convention: default = primary purple, secondary = pink, delete the duplicate; remove 'glass'; fix 'transparent' to use a foreground token (text-foreground or text-white where it's genuinely only used on dark headers, then rename it to say so).
**Files**: src/components/ui/button.tsx, src/components/ui/badge.tsx

### [P2] Dark mode is incomplete at the token layer and then 'fixed' by !important CSS hacks: .dark never remaps --accent, --accent-foreground, or --ring, so hover:bg-accent rows in dropdowns/selects/command flash near-white (96% lightness) inside dark popovers; meanwhile globals.css `.dark button[class*="bg-secondary"]` rewrites every default Button with !important translucent-pink backgrounds, glow box-shadows, and translateY(-1px) hover motion, silently overriding the primitive's own declared states.

**Why**: The primitive's state contract (hover:bg-secondary/90 etc.) is dead code in dark mode; what users actually see is defined by a blanket attribute selector nobody will find when debugging. That's the definition of inconsistent component vocabulary.

**Fix**: Add dark values for --accent/--accent-foreground (and audit --ring) in the .dark block; delete the `.dark button[class*="bg-secondary"]`, .widget-*, .chat-send-button !important blocks and express those looks as proper variants or dark: classes inside button.tsx.
**Files**: src/app/globals.css, src/components/ui/button.tsx, src/components/ui/dropdown-menu.tsx, src/components/ui/select.tsx, src/components/ui/command.tsx

### [P2] The form-control vocabulary is split in two: Input/Textarea use rounded-[10px], shadow-sm, focus:shadow-md, and hover:border-secondary/30, while SelectTrigger (which sits beside them in every form) is rounded-md with no shadow and no hover state. None of the three has any aria-invalid/error styling.

**Why**: Register: 'Every interactive component has: default, hover, focus, active, disabled, loading, error. Don't ship with half of these' and 'same form-control vocabulary.' A form with a text field and a select currently shows two different design languages, and errors have no visual channel at the primitive level at all.

**Fix**: Pick one treatment (recommend the quieter Select style: tokened radius, no shadow), apply to Input/Textarea/SelectTrigger; add aria-invalid:border-destructive aria-invalid:ring-destructive/30 to all three.
**Files**: src/components/ui/input.tsx, src/components/ui/textarea.tsx, src/components/ui/select.tsx

### [P2] Token/consistency drift across overlays and details: hard-coded rounded-[10px]/rounded-[6px] arbitrary values instead of the rounded-lg/md tokens that already equal 10px; tooltip z-[9999] vs z-50 system-wide; dead classes (border-opacity-30 does nothing because colors aren't defined with <alpha-value>; backdrop-blur-sm on opaque bg-background dialog content); Progress fill hard-codes Tailwind pink-500/600 gradient — a different pink than brand --secondary; TableFooter is solid bg-primary dark purple (upstream: bg-muted/50); sheet close button data-[state=open]:bg-secondary goes hot pink.

**Why**: Each item is small, but together they mean the token system can't be trusted: change --radius or --secondary and half the primitives don't follow. This is exactly the 'pause at every subtly-off component' failure the register describes.

**Fix**: Sweep: rounded-[10px]→rounded-lg, rounded-[6px]→rounded-md, z-[9999]→z-50 (fix stacking properly if something needed 9999), delete border-opacity-30/backdrop-blur-sm from opaque surfaces, Progress fill→bg-secondary flat, TableFooter→bg-muted/50, sheet close→bg-accent to match dialog.
**Files**: src/components/ui/button.tsx, src/components/ui/dialog.tsx, src/components/ui/dropdown-menu.tsx, src/components/ui/tooltip.tsx, src/components/ui/progress.tsx, src/components/ui/table.tsx, src/components/ui/sheet.tsx, src/components/ui/input.tsx, src/components/ui/textarea.tsx

## Persona Red Flags

- Sam (screen-reader/keyboard-only): calendar.tsx prev/next buttons (lines 116-132) are icon-only with no aria-label — announced as 'button'; <tr className="flex"> strips row semantics so the date grid reads as a flat unlabeled button list; no aria-selected on the chosen day; no arrow-key navigation. command.tsx hardcodes the hidden title 'Global Workspace Search' (lines 43-50), so every CommandDialog in the app — pickers, switchers — announces itself as workspace search.
- Alex (impatient power user): DropdownMenuItem and DropdownMenuContent apply transition-standard (transition: all, 200ms) so keyboard traversal of menus visibly lags each highlight (dropdown-menu.tsx lines 66, 85); DialogContent animates at duration-slow 300ms — above the register's 150-250ms band — on every open (dialog.tsx line 42); SheetContent opens at 500ms (sheet.tsx line 34); slider gives no at-a-glance value so he has to scrub to read it.
- Riley (stress-tester): Button forces whitespace-nowrap with no truncation, so a long label blows out any fixed-width container (button.tsx line 8); Badge has no max-width/truncate; calendar.tsx re-allocates new Date and re-invokes the disabled() callback for all ~42 cells on every render and desyncs from a controlled parent because month changes are never reported (no onMonthChange).

## Minor Observations

- No prefers-reduced-motion handling anywhere in the primitives or globals: active:scale-[0.98] on Button, hover:shadow transitions on Avatar, zoom/slide dialog animations, and html { scroll-behavior: smooth } all run unguarded despite PRODUCT.md's 'reduced-motion aware' principle.
- input-otp.tsx uses animate-caret-blink but no caret-blink keyframe/animation is registered in tailwind.config.ts — the class compiles to nothing, so the fake caret is a static bar (and duration-1000 there sets transition-duration, not animation-duration).
- badge.tsx carries focus:ring-2 focus:ring-ring on a plain <div> that can never receive focus — dead styles inherited from upstream; if badges are ever interactive they should be buttons.
- avatar.tsx hover:shadow-md on the Root implies clickability on every avatar, interactive or not — a false affordance; move elevation to the call sites that are actually buttons.
- dialog.tsx isThumbnail close-button uses hard-coded bg-white, which the global `.dark [class*="bg-white"]` !important hack will silently repaint in dark mode.
- alert.tsx AlertTitle is a fixed <h5>, which will produce out-of-order heading levels in most placements; a polymorphic `as` like CardTitle already has would fix it.
- checkbox.tsx Check icon is h-4 w-4 inside an h-4 w-4 box with a border — glyph touches the border box edge-to-edge; upstream compensates with the indicator's centering, but a 3.5 icon would breathe.
- sonner.tsx relies on next-themes useTheme; fine, but toast styles are also overridden by the `.dark .toast` !important block in globals.css — one of the two should own it.

## Per-Component Notes

- `src/components/ui/slider.tsx` — Range and Track are both bg-secondary — value fill is invisible. Track → bg-muted or bg-secondary/20, Range → bg-secondary. Thumb border-secondary is fine once the track quiets down.
- `src/components/ui/button.tsx` — Collapse default/secondary duplicates and restore shadcn semantics (default = primary action); delete glass; fix transparent's text-accent (invisible on light); rounded-[10px] → rounded-lg token; drop shadow-md/hover:shadow-lg for a flatter product look; add a loading prop (spinner + disabled) per register; guard active:scale with motion-reduce.
- `src/components/ui/calendar.tsx` — Replace with react-day-picker or fix: aria-labels on nav buttons, real grid semantics (no flex on <tr>), aria-selected/aria-current, arrow-key roving tabindex, onMonthChange for controlled use, and stop calling disabled() 42x per render.
- `src/components/ui/badge.tsx` — default === secondary — delete one; success/warning bypass tokens (bg-green-500/bg-yellow-500) and warning's white-on-yellow is ~1.9:1 — use dark foreground and add --success/--warning tokens; remove dead focus ring styles from the non-focusable div.
- `src/app/globals.css` — (read as required token context) .dark misses --accent/--accent-foreground/--ring remaps so hover states flash white in dark menus; the `.dark button[class*="bg-secondary"]` / .widget-* / .chat-send-button !important blocks override Button's declared states with glow + translateY motion — fold these into component variants and delete.
- `src/components/ui/input.tsx` — Align with SelectTrigger (one form vocabulary): tokened radius, drop shadow-sm/focus:shadow-md and hover:border-secondary/30 or apply the same to Select; add aria-invalid:border-destructive + ring styles — there is currently no error state.
- `src/components/ui/textarea.tsx` — Same fixes as Input (radius token, shadow/hover parity, aria-invalid styles); also consider field-sizing/resize guidance for long content.
- `src/components/ui/select.tsx` — Trigger is rounded-md/flat while Input is rounded-[10px]/shadowed — unify; add aria-invalid styling; content radius (rounded-md) should match whatever dropdown/popover settle on.
- `src/components/ui/dropdown-menu.tsx` — rounded-[6px] items vs rounded-sm checkbox/radio items in the same file; hover:bg-accent/50 + focus:bg-accent produce two different highlight intensities for the same 'hovered' row (Radix focuses on hover); transition-standard (all/200ms) → transition-colors at duration-fast; remove dead backdrop-blur-sm/border-opacity-30.
- `src/components/ui/dialog.tsx` — Remove backdrop-blur-sm + border-opacity-30 from opaque content (dead/decorative); duration-slow (300ms) → duration-normal per register's 150-250ms; rounded-[10px] → rounded-lg; isThumbnail bg-white → token.
- `src/components/ui/tooltip.tsx` — z-[9999] breaks the z-scale (everything else z-50) — fix the underlying stacking context instead; drop transition-all duration-200 (fights animate-in) and dead blur/border-opacity classes.
- `src/components/ui/progress.tsx` — Fill hard-codes pink-500→600 gradient — not the brand pink and a token bypass; use bg-secondary flat, add an indeterminate state, and align track color with Slider.
- `src/components/ui/sheet.tsx` — Close button data-[state=open]:bg-secondary renders a hot-pink chip while open (upstream assumed gray secondary) — use bg-accent like dialog; 500ms open animation exceeds the register band, use ~250-300ms.
- `src/components/ui/command.tsx` — CommandDialog hardcodes 'Global Workspace Search' title/description — every non-search CommandDialog announces the wrong context to screen readers; accept title/description props with sensible defaults.
- `src/components/ui/checkbox.tsx` — Unchecked box wears a full-saturation pink border — heavy accent on an inactive state (register ban); use border-input unchecked, secondary only when checked.
- `src/components/ui/avatar.tsx` — Remove hover:shadow-md false affordance from Root; fallback white-on-pink initials ~3.6:1 — needs darker bg or different pairing; rounded-md (vs upstream rounded-full) is a legitimate identity choice, keep it consistent everywhere.
- `src/components/ui/table.tsx` — TableFooter bg-primary text-primary-foreground is a solid dark-purple slab (upstream: bg-muted/50) — heavy for a data surface; revert to muted.
- `src/components/ui/input-otp.tsx` — animate-caret-blink has no registered keyframe so the caret never blinks — add the caret-blink keyframe/animation to tailwind.config.ts; the click-to-position slot behavior is good, keep it.
- `src/components/ui/alert.tsx` — Destructive variant text (hsl 0 100% 65%) on white is ~3.3:1 — below AA; darken --destructive or use a darker text tone; AlertTitle's fixed h5 should be polymorphic like CardTitle.
- `src/components/ui/card.tsx` — CardTitle text-2xl is oversized for a dense product register (most real usage will override) — consider text-lg/xl default; the polymorphic `as` prop is a strength, document it.
- `src/components/ui/tabs.tsx` — Clean and stock; only note: focus-visible ring uses pink --ring inside a muted TabsList — verify 3:1 non-text contrast against bg-muted in dark mode once --accent/--ring dark values are fixed.
- `src/components/ui/sonner.tsx` — Fine, but ownership of dark toast styling is split with the `.dark .toast` !important block in globals.css — delete the global block and let this component own it.

## Questions to Consider

- Is Button's 'transparent' variant (text-accent — 96%-lightness text) only ever used on the purple sidebar/header? On any light surface it is invisible; if it's a dark-surface-only variant it should be named and documented as such.
- Are the .dark !important overrides in globals.css (button[class*='bg-secondary'], .widget-*, .chat-send-button) a temporary bridge or the intended dark-mode design? They currently define what Button actually looks like in dark mode, outside the component.
- Was the react-day-picker → hand-rolled Calendar rewrite deliberate (bundle size? API mismatch?), and is feature parity (range select, keyboard grid) expected to return?
- Is there an intended semantic split between --primary (purple) and --secondary (pink) for actions — i.e., which one is 'the' CTA color? Call sites currently get pink from default Button and purple from variant='primary', and the answer determines how the variant collapse should go.
