# Proddy Restyle — Style Guide (fintech-dashboard)

Authoritative reference for the repo-wide UI restyle. The **foundation** (tokens,
`src/components/ui/*` primitives, shared components below, workspace shell) is
already done. Per-area work builds on it — **never re-implement foundation**.

Aesthetic: soft-gray app canvas, white `rounded-2xl` cards with 1px borders +
soft shadows, pill controls, purple (`--primary`, unchanged) as the single
interactive accent, quiet CSS-first motion. Register is **product** (PRODUCT.md):
density/speed/clarity over delight; no gradients/glassmorphism/blur; motion
explains state changes, never decorates; accessible contrast + focus always.

---

## 1. Tokens (use these — never raw hex / `gray-*` / `slate-*`)

| Token | Role |
|---|---|
| `bg-background` | soft-gray app canvas (`220 20% 97%`) — page scroll containers only |
| `bg-card` | white raised surface (cards, inputs, modals, popovers, table bands) |
| `bg-muted` / `text-muted-foreground` | quiet fills / secondary text (AA on canvas) |
| `border-border` | 1px hairlines |
| `bg-primary` / `text-primary` | deep purple `#4A0D68` — primary actions, active states, accents |
| `--secondary` (magenta) | **AI-accent + marketing garnish ONLY** — do not use for generic controls |
| `text-success` / `bg-success/10` | positive / up-delta / "completed" |
| `text-warning` / `bg-warning/10` | caution states |
| `text-destructive` / `bg-destructive/10` | errors / down-delta / danger |
| `ring-ring` | focus ring (now purple) |
| `bg-sidebar` / `text-sidebar-foreground` / `bg-sidebar-accent` | shell sidebar |

Radius: `--radius` is **12px**. Cards use literal `rounded-2xl` (16px). Controls
(buttons, tabs, badges, chips, search) are `rounded-full`. Menus/popovers/dialogs
`rounded-xl`/`rounded-2xl`. **Never** hardcode `rounded-[10px]` etc.

Shadows: `shadow-sm` (resting cards), `shadow-md` (hover/raised), `shadow-lg`
(popovers/menus), `shadow-xl` (dialogs). Softer/wider than before.

Font: Inter, wired via `font-sans` (already global). Numerals get `tabular-nums`.

Type scale: page h1 `text-2xl font-semibold tracking-tight`; card title
`text-base font-semibold`; stat numeral `text-3xl font-semibold tracking-tight
tabular-nums`; overline/section label `text-[11px] font-semibold uppercase
tracking-[0.08em] text-muted-foreground`; table head `text-xs font-medium
text-muted-foreground`; body `text-sm`.

---

## 2. Shared components (import; do not duplicate)

```tsx
import { StatCard, getDeltaVisual } from "@/components/stat-card";
import { StatusDot } from "@/components/status-dot";       // type StatusTone
import { PageShell } from "@/components/page-shell";
import { EmptyState } from "@/components/empty-state";
import { AnimatedNumber } from "@/components/animated-number";
```

- **StatCard** `{ label, value, delta?, deltaLabel?, icon?, action? }` — white
  tile, big numeral, soft delta chip (green up / red down / neutral). `value`
  can be an `<AnimatedNumber value={n} format={fn} />`. `getDeltaVisual(change)`
  → `{ Icon, chipClass, label }` for custom chip layouts.
- **StatusDot** `{ tone, label? }` — `tone: "success"|"warning"|"destructive"|
  "neutral"|"primary"`. The "● Success" table/status cell. Never color-only.
- **PageShell** `{ children, maxWidth? }` — soft-gray scroll container +
  `max-w-[1400px]` + padding. Adopt on content pages (dashboard/reports/usage/
  tasks/manage/calendar). **Not** for full-bleed chat/board/canvas/notes.
- **EmptyState** `{ icon, title, description?, action?, size? }` — dashed
  `rounded-2xl` empty state. `size="md"` matches widget height; `"sm"` = content.
- **AnimatedNumber** `{ value, format?, duration? }` — count-up, reduced-motion
  → static, always `tabular-nums`. Use only inside stat values.

---

## 3. Primitive recipes (already applied — match them in feature code)

- **Card**: `rounded-2xl border bg-card shadow-sm`. For hover-lift pass
  `interactive` prop (→ `-translate-y-0.5 hover:shadow-md`, reduced-motion safe).
- **Button**: pills. `default`/`primary` = purple; `secondary` = neutral muted
  pill (`bg-muted`); `outline` = `border-border bg-card hover:bg-muted`; `ghost`
  = `hover:bg-muted/60`. Promote true primary CTAs to `default` (secondary is now
  quiet).
- **Tabs**: pill segmented control (`rounded-full bg-muted p-1`; active
  `bg-card shadow-sm`). Use for tab bars — don't hand-roll segmented buttons.
- **Badge**: soft-tint chips — `success`/`warning`/`secondary`/`primarySoft`/
  `destructiveSoft` are `bg-*/10 text-*`. `default`/`destructive` stay solid.
- **Input/Textarea/Select**: `rounded-lg bg-card` with soft focus (border tints +
  `ring-ring/20`). Search fields → wrap in a `rounded-full` container per refs.
- **Table**: roomy — `TableHead` `text-xs font-medium text-muted-foreground`,
  rows `hover:bg-muted/40 border-border/70`, cells `px-4 py-3.5`. Status column →
  `StatusDot`, not a badge.
- **Dialog/AlertDialog**: `rounded-2xl bg-card`, overlay `bg-black/50` (no blur).
- **Tooltip**: dark pill (`bg-foreground text-background rounded-full`).

---

## 4. Motion grammar (fixed vocabulary — CSS-first, quiet)

- Card hover lift → `Card interactive` (150ms, motion-reduce safe). Don't invent
  other hover transforms.
- Button press → existing `active:scale-[0.98]` (already in primitive).
- Tabs → color/shadow crossfade (built into TabsTrigger). No sliding indicator in
  shared usage.
- Menus/dialogs/popovers/tooltips → keep `tailwindcss-animate` fade+zoom.
- Sidebar/list item hover → background only (`hover:bg-muted`/`bg-sidebar-accent`).
  **No** `translate-x`, **no** `scale-110` icon hovers.
- Numeric count-up → `AnimatedNumber` only.
- **No** page/section entrance animations, float, or pulse on chrome.
- Every transform ships a `motion-reduce:` counterpart; framer paths use
  `useReducedMotion()`. framer-motion stays landing-only + AnimatedNumber; inside
  `/workspace` use CSS utilities (`transition-standard`/`transition-fast`).
- Do NOT add `motion.div` per item in long lists (kanban, message list — not
  virtualized). CSS transitions only there.

---

## 5. Do / Don't

**Do:** use tokens + shared components; delete local `bg-background` page canvases
(the shell/PageShell provides the canvas); replace `bg-background` used as a
*white surface* with `bg-card`; convert raw `green-500`/`red-*`/`emerald-*`/
`amber-*` status colors to `success`/`warning`/`destructive` (chip = `bg-*/10
text-*`); convert `bg-gray-100`/`bg-gray-50` to `bg-muted`; replace
`rounded-[Npx]` with token radii.

**Don't:** edit foundation files (`globals.css`, `tailwind.config.ts`,
`src/app/layout.tsx`, `src/components/ui/*`, `src/components/{stat-card,status-dot,
page-shell,empty-state,animated-number}.tsx`, the workspace shell) — file a "## FCR"
in your report instead. Don't change behavior/props/exports/routing. Don't touch
third-party internals (Quill/dnd-kit/Excalidraw/BlockNote/Stream) — only wrapper
chrome + documented CSS vars. Don't use `--secondary` for generic controls. Don't
add blur/glassmorphism/gradients.

Biome: TABS, double quotes, 80 cols. Verify with
`bunx biome check --write <your files>` then `bun run type`.
