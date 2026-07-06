---
target: Reports
total_score: 14
p0_count: 1
p1_count: 4
timestamp: 2026-07-06T14-48-45Z
slug: src-features-reports
---
# Critique — Reports

Method: dual-agent (A: design review · B: detector) — browser evidence skipped (dev server not running)
Paths: src/features/reports

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of system status | 2 | Loading is signaled, but as a full-view blocking spinner on every dashboard and every time-range switch (register demands skeletons); endDate is frozen at mount (useMemo(() => Date.now(), []) in all 5 dashboards) so 'liv |
| 2 | Match between system and real world | 1 | Performance metrics show random and hardcoded numbers as fact; 'Tasks by Assignee' actually shows creators (admitted in a code comment); formatDuration expects ms but dashboards feed it what their own threshold constants |
| 3 | User control and freedom | 2 | 1d/7d/30d presets only — no custom range; chart onClick/onSegmentClick APIs exist but are wired nowhere, so no drill-down from any chart to the underlying channel/user/task. |
| 4 | Consistency and standards | 1 | Task-status pie uses Not Started=#a855f7/On Hold=#eab308 in performance-metrics-dashboard.tsx but #6b7280/#f59e0b for the identical data on the Tasks tab; three different empty-state treatments (dashed-border circle, bg- |
| 5 | Error prevention | 2 | Read-only surface so little to prevent, but division-by-zero styling exists in places while Progress values can exceed 100 (activityScore/2) or go negative (100 - avgCompletionTime*10). |
| 6 | Recognition rather than recall | 2 | Green/yellow/pink time-spent color thresholds and green/yellow/red response-time bands are never explained anywhere in the UI; 'Score: 42' has no defined unit or scale; the same 'Total Messages' number appears on four ta |
| 7 | Flexibility and efficiency of use | 1 | No custom date range, no comparison toggle, no chart-type choice, no keyboard shortcuts, no drill-down; power users must eyeball 7 flat tabs (plus nested tab levels) to find one number. |
| 8 | Aesthetic and minimalist design | 1 | 3D extruded pie with hover-eject and glow legend dots; 8-color decorative gradient rotation on channel bars; staggered slide-in bar choreography (index*50ms, up to ~500ms); 7 tabs where content overlaps heavily (Messages |
| 9 | Help users recognize, diagnose, recover from errors | 1 | No error state exists in any dashboard — a failed Convex query leaves the component on an infinite spinner or an unhandled throw; only the export path (outside target) has error feedback. |
| 10 | Help and documentation | 1 | Metric definitions ('active user', 'response time', 'activity score', completion thresholds) are never explained; the single tooltip (active-user names on the Overview card) is mouse-only and unbounded in height. |
| **Total** | | **14/40** | |

## Anti-Patterns Verdict

A user fluent in Linear or Notion would not trust this surface past the second tab. The skeleton is respectable — shadcn cards, consistent KPI-grid grammar, tooltips and empty states everywhere — but three things destroy trust: (1) the Performance tab and parts of Content are literally fabricated (Math.random() task counts, hardcoded 78% on-time rate, image-upload charts synthesized by scaling message counts), presented with confident 'Good/Needs Improvement' judgment badges; (2) the hand-rolled 3D extruded pie chart with hover-eject animation, glow-dot legend, and brightness filters is textbook dashboard slop that distorts the very proportions it exists to show; (3) color is undisciplined — five hardcoded hex palettes, rainbow gradients assigned to channels by index, and the same task-status data painted two different color schemes on two tabs. The --chart-1..5 tokens defined in globals.css are never used. It photographs like a dashboard and reads like a template — exactly the 'impresses in a screenshot, exhausts in daily use' anti-reference PRODUCT.md names.

**Deterministic scan**: 6 findings — ai-color-palette ×6.

## Cognitive Load

- <=4 visible options per decision point: FAIL — 7 top-level tabs on the Reports page, then 3 more sub-tabs inside Content and 2 inside Performance (two stacked tab hierarchies)
- No working-memory bridges: FAIL — green/yellow/pink time-spent bands (channel-activity-dashboard.tsx lines 129-134) and green/yellow/red response-time bands are never legended; 'Score: N' (performance-metrics-dashboard.tsx line 560) has no defined scale; the same Total Messages figure appears on 4 tabs with different denominators (per user / per active user / per channel)
- Clear hierarchy: FAIL — four nested labels say the same thing (toolbar 'Reports' → h1 'Reports & Analytics' → tab name → each dashboard's redundant h2 like 'Workspace Overview' sitting in an empty justify-between row)
- Progressive disclosure: FAIL — every tab renders all KPIs, all charts, and all lists at once; fake gray 100% 'No Data Available' pies render a full 3D chart of nothing instead of deferring
- Single focus: PARTIAL — individual dashboards are reasonably scoped, but Performance mixes task metrics, per-user rankings, and response times in one scroll
- Chunking <=4: PASS — KPI rows cap at 4, chart grids at 2
- Visual grouping: PASS — card boundaries group related content consistently
- One decision at a time: PASS — time range and tab selection are independent, sequential choices

## What's Working

- Consistent structural grammar: every dashboard opens with a 4-up KPI card grid then a 2-col chart grid, all on shadcn Card primitives — the bones of 'one system' are there
- Empty states exist for essentially every chart and every dashboard, with icon + heading + explanation of how data will appear
- Keyboard activation was at least attempted throughout the charts (Enter/Space handlers on bars, points, segments, legend items)
- Pie legend shows exact formatted values next to labels in tabular monospace, so precise numbers don't depend on hovering the chart
- Charts are dependency-free hand-rolled SVG/DOM — no heavyweight chart library dragged in for four chart types
- Loading and skip states are handled defensively on every Convex query (workspaceId ? args : 'skip')

## Priority Issues

### [P0] Fabricated data presented as real analytics: performance-metrics-dashboard.tsx hardcodes avgCompletionTime=2.5 days (line 94-97) and onTimeCompletionRate=78% (line 100-103), generates tasksByAssignee and userPerformanceData with Math.random() (lines 111-127, 199-216), and scales taskCompletionTrend by a fake *0.7 (line 183); content-analysis-dashboard.tsx synthesizes 'Image Uploads Over Time' and 'Top Image Uploaders' by multiplying message counts by an image percentage with a magic fallback of 15 (lines 376-425)

**Why**: Admins are shown random numbers with authoritative 'Good / Needs Improvement' judgment badges and will make people-management decisions on fiction; because Math.random() sits inside useMemo keyed on reactive Convex data, the numbers visibly reshuffle whenever data refreshes — instantly destroying trust in the whole Reports module

**Fix**: Delete every metric the backend can't supply. Ship the Performance tab with only real fields (completion rate, status/priority counts) and mark the rest as explicit 'Not tracked yet' placeholders, or remove the tab until convex/planning provides completion-time and assignee data. Never render a chart from synthesized values.
**Files**: src/features/reports/components/performance-metrics-dashboard.tsx, src/features/reports/components/content-analysis-dashboard.tsx

### [P1] Time-spent unit contradiction: channel-activity-dashboard.tsx defines thresholds in seconds (TWO_HOURS_IN_SECONDS=7200, lines 24-25) and user-activity-dashboard.tsx likewise (lines 21-22), then both pass the same raw value to formatDuration() which documents and treats its input as milliseconds (format-duration.ts line 2, `ms / 1000` at line 9)

**Why**: Whichever unit the backend actually returns, either every displayed duration is wrong by 1000x (7200 treated as 7.2s → '7s') or every green/yellow color band is wrong by 1000x — users see durations and color-coded 'engagement' that cannot both be true

**Fix**: Pick one unit at the API boundary, rename the value (totalTimeSpentMs), convert once, and derive thresholds from the same constant so display and color can never diverge
**Files**: src/features/reports/components/channel-activity-dashboard.tsx, src/features/reports/components/user-activity-dashboard.tsx, src/features/reports/utils/format-duration.ts

### [P1] The 668-line hand-rolled 3D pie chart: elliptical projection with 12-unit depth extrusion, HOVER_EJECT segment pop-out, brightness(1.15) filters, glow box-shadows on legend dots (boxShadow: `0 0 8px ${color}`), and scale-105/125 hover transforms (pie-chart.tsx lines 245-525, 604-620)

**Why**: 3D ellipse projection distorts the proportions the chart exists to communicate (segments at the front read larger); the eject/glow/scale motion is pure decoration, explicitly banned by the product register ('motion conveys state, not decoration'); and the absolute top-right legend with whitespace-nowrap labels collides with the pie and escapes the card with long channel names

**Fix**: Replace with a flat donut or plain horizontal-bar breakdown using the existing --chart-1..5 tokens; keep hover-to-highlight and the value legend, delete depth layers, eject offsets, glow shadows, and scale transforms — that also deletes ~400 lines and the entire pie-chart-paths.ts side-path machinery
**Files**: src/features/reports/components/charts/pie-chart.tsx, src/features/reports/components/charts/utils/pie-chart-paths.ts, src/features/reports/components/charts/utils/color-utils.ts

### [P1] Charts are keyboard/screen-reader dead ends: pie segments and legend rows are always focusable role='button' tabIndex=0 elements with no accessible name even when onSegmentClick is undefined (pie-chart.tsx lines 393-427, 570-608); every HorizontalBarChart row is a <button> regardless of interactivity (horizontal-bar-chart.tsx lines 54-72); LineChart/BarChart tooltips fire only on mouseEnter so keyboard focus reveals nothing (line-chart.tsx lines 259-260, bar-chart.tsx lines 110-111); trend text-green-500/text-red-500 on white is ~2.3:1 and ~3.8:1 — both fail 4.5:1 (overview-dashboard.tsx lines 232, 290, 326)

**Why**: A keyboard or screen-reader user (Sam) tabs through dozens of unnamed 'button' announcements that do nothing, gets no values from any chart, and can't read the trend deltas — the module's core content is inaccessible, and PRODUCT.md calls accessibility non-negotiable

**Fix**: Make chart elements focusable only when a click handler exists; add aria-label=`${label}: ${formatValue(value)}` to every segment/bar/point; show the tooltip on focus as well as hover; swap trend colors to green-700/red-600 (or add a filled badge); add a visually-hidden table or aria-describedby summary per chart
**Files**: src/features/reports/components/charts/pie-chart.tsx, src/features/reports/components/charts/horizontal-bar-chart.tsx, src/features/reports/components/charts/line-chart.tsx, src/features/reports/components/charts/bar-chart.tsx, src/features/reports/components/overview-dashboard.tsx

### [P1] Color anarchy across the module: five separate hardcoded hex palettes (overview task split #1e40af/#60a5fa; content types #a78bfa..#f472b6; message length #a5b4fc..#4f46e5; status and priority sets), a comment in channel-activity-dashboard.tsx lines 166-172 that names the chart tokens ('chart-1: coral') while hardcoding hex instead of using them, decorative 8-gradient rotation for channel bars (lines 106-115, 145-154), and the same status data colored differently on two tabs

**Why**: Violates 'one system' and the register's token discipline — dark mode can't retint any of it, the identical concept (task status) has two visual vocabularies, and gradient-by-index tells users color means something when it means nothing

**Fix**: Define one semantic mapping (status→color, priority→color, series→--chart-1..5) in a single charts/colors.ts consuming the CSS variables; delete every inline hex and every bg-gradient-to-r series color
**Files**: src/features/reports/components/channel-activity-dashboard.tsx, src/features/reports/components/overview-dashboard.tsx, src/features/reports/components/content-analysis-dashboard.tsx, src/features/reports/components/performance-metrics-dashboard.tsx

### [P2] Every dashboard swaps the entire view for a centered spinner while loading, and re-blocks on each time-range change; no dashboard has any error state; endDate never refreshes after mount

**Why**: Register: 'skeleton states for loading, not spinners in the middle of content'; an impatient operator toggling 7d→30d loses all context to a spinner flash, and a failed query strands them on an infinite spinner with no recovery path

**Fix**: Render the card grid immediately with skeleton KPI/chart placeholders keyed to the layout; keep previous data visible while the range query refetches; add a per-dashboard error state with a retry action; refresh endDate on an interval or on tab focus
**Files**: src/features/reports/components/overview-dashboard.tsx, src/features/reports/components/user-activity-dashboard.tsx, src/features/reports/components/channel-activity-dashboard.tsx, src/features/reports/components/content-analysis-dashboard.tsx, src/features/reports/components/performance-metrics-dashboard.tsx

### [P2] IA duplication across the 7-tab surface: 'Top Message Senders' and the messages-over-time line chart render identically in both the Messages tab and Content>Messages; Users tab overlaps Performance>User Performance; Channels overlaps Content>Activity Patterns response times; 'Total Messages' KPI appears on four tabs

**Why**: Users can't predict where a metric lives and must remember which tab held which chart (working-memory bridge); 7 top-level choices plus nested tab levels exceeds any reasonable decision budget for a reporting surface

**Fix**: Collapse to 4 tabs (Overview, People, Channels, Tasks), fold Content's activity patterns into Channels and its message analysis into Overview, and let each metric live in exactly one place
**Files**: src/features/reports/components/content-analysis-dashboard.tsx, src/features/reports/components/performance-metrics-dashboard.tsx, src/features/reports/components/user-activity-dashboard.tsx

## Persona Red Flags

- Alex (impatient power user): switching 7d→30d throws every dashboard back to a full-height spinner (isLoading gate in all five dashboards) losing scroll position and context; endDate = useMemo(() => Date.now(), []) means the 'current' report silently stops updating until a hard refresh — in a product whose brief says 'real-time by default'; no custom date range and no drill-down from any chart despite onBarClick/onSegmentClick props existing
- Sam (screen-reader/keyboard-only): pie-chart.tsx renders every segment as <g role='button' tabIndex={0}> with no aria-label — announced as dozens of unnamed 'button's; horizontal-bar-chart.tsx makes every data row a focusable <button> that does nothing; LineChart points set hover state only via onMouseEnter (line-chart.tsx line 259) so focus reveals no tooltip; trend deltas in overview-dashboard.tsx use text-green-500 (~2.3:1) and text-red-500 (~3.8:1) on white — both fail WCAG AA
- Riley (stress-tester): Performance-tab numbers visibly reshuffle on every Convex data refresh because Math.random() lives inside useMemo (performance-metrics-dashboard.tsx lines 115-116, 200-202); a 30-day range gives LineChart 30 x-axis labels in a flex justify-between row (line-chart.tsx lines 295-311) that overlap illegibly at laptop widths; a long channel name in the pie legend (whitespace-nowrap, absolute top-right, pie-chart.tsx line 626) escapes the card; previous-period=0 makes every trend read exactly '+100%' (overview-dashboard.tsx line 134)

## Minor Observations

- overview-dashboard.tsx: trends only render when previousOverviewData has loaded — trend badges pop in late with no layout reservation, shifting KPI card content
- pie-chart.tsx legend uses inline fontFamily: 'ui-monospace, monospace' — the only monospace text in the module, inconsistent with the app's Poppins-based UI
- horizontal-bar-chart.tsx/bar-chart.tsx use transition-all duration-500/300 — exceeds the register's 150-250ms guidance and the app's own --duration tokens go unused
- performance-metrics-dashboard.tsx line 341: Progress value={100 - avgCompletionTime * 10} goes negative for completion times over 10 days
- Empty-state copy varies in voice: 'Start interacting with channels to generate activity data' (imperative) vs 'Messages will appear here once users start chatting' (passive) vs bare 'No data available'
- channel-activity-dashboard.tsx: 'Most Active Channel' KPI shows 'None' as a fake channel name when empty — prefer an em dash or muted 'No activity'
- pie-chart.tsx: fixed-position tooltip with zIndex 9999 can escape the viewport near right/bottom edges — no flip logic unlike bar-chart's calculateDomTooltipPosition
- user-activity-dashboard.tsx: 'per user' denominators use totalMembers while time-spent uses activeUsers — adjacent cards divide by different populations without saying so

## Per-Component Notes

- `src/features/reports/components/performance-metrics-dashboard.tsx` — Remove all Math.random()/hardcoded metrics (lines 94-103, 111-127, 178-216); rename 'Tasks by Assignee' (it shows creators); unify status palette with the Tasks tab; Progress value={user.activityScore / 2} can exceed 100 — clamp; the disabled-state cards showing ghosted fake '78%' teach users a number that was never real.
- `src/features/reports/components/charts/pie-chart.tsx` — Flatten to 2D donut; drop depth layers, HOVER_EJECT, brightness filters, glow legend dots, and scale transforms; make segments focusable only when clickable and give each an aria-label; legend needs max-width + truncation and must not overlay the chart; tooltip hardcodes dark:bg-gray-900 instead of tokens.
- `src/features/reports/components/content-analysis-dashboard.tsx` — Delete synthesized image charts (lines 376-435) until real per-message attachment counts exist; remove dead _searchQuery/_activeTab state; 'No Data Available' should not render as a 100% gray pie segment — use the standard empty-state block; hex palette → chart tokens.
- `src/features/reports/components/overview-dashboard.tsx` — Fix 'in last 7 days' copy that ignores timeRange (line 305); 0% change renders as green TrendingUp — add a neutral state; only the Active Users card is hover-interactive with cursor-help while siblings are inert — inconsistent affordance; active-user tooltip list is unbounded (cap + 'and N more'); task-split hexes #1e40af/#60a5fa → tokens; blue stat pills (lines 432-447) introduce yet another accent family.
- `src/features/reports/components/charts/line-chart.tsx` — Cap or rotate x-axis labels for 30-point ranges (thin to ~6 ticks); points need onFocus to drive the tooltip and a visible focus ring; the li onFocus handlers (line 304) are dead — li isn't focusable; strip console.warn from the render path; area fill hardcodes secondary — accept a token-driven series color.
- `src/features/reports/components/charts/horizontal-bar-chart.tsx` — Render a div (not button) when onBarClick is absent; height prop is accepted but ignored everywhere it's passed (height={30}); staggered slide-in-from-left with index*50ms delay is load choreography — remove or honor prefers-reduced-motion; value text should be tabular-nums for scanning.
- `src/features/reports/components/channel-activity-dashboard.tsx` — Kill the 8-gradient decorative rotation for message/visitor bars — one token color, or use color only where it encodes a real threshold; pie shows top-5 channels but silently drops the rest — add an 'Other' bucket; fix seconds-vs-ms thresholds (lines 24-25 vs formatDuration); the pieData hexes duplicate --chart-1..5 by hand.
- `src/features/reports/components/charts/bar-chart.tsx` — Focusable buttons show no tooltip on keyboard focus (tooltip driven by mouseEnter only, line 110); default bar color bg-pink-500 bypasses tokens; hover scale-105 on bars is decorative jitter; staggered animate-in delays ignore reduced motion.
- `src/features/reports/components/user-activity-dashboard.tsx` — Same seconds/ms threshold bug as channel-activity (lines 21-22); mixing semantic threshold colors (green/yellow) with brand bg-secondary pink as the 'low' band reads as three unrelated hues — use one sequential scale; 'Active Users' here vs Overview pull from different queries and can disagree on the same screen-session.

## Questions to Consider

- Does convex/workspace/analytics return totalTimeSpent in seconds or milliseconds? The answer decides which half of the time-spent UI (colors or labels) is currently lying.
- Is the Performance tab feature-flagged or visible to all admins in production? If visible, the fabricated metrics are an active trust incident, not just debt.
- Are there designs or backend plans for real assignee/completion-time data, or should the Performance tab be cut from IA entirely?
- The reports page gates out role === 'member' — is Reports intentionally admin-only? Several empty states ('Start interacting with channels...') address end users who can never see them.
