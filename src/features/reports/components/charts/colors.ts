/**
 * Shared color vocabulary for the reports dashboards.
 *
 * Every dashboard used to invent its own hex/gradient palette for the same
 * concepts (task status, task priority, a chart series slot, an
 * intensity/magnitude scale), so "completed" or "series #2" could render in a
 * different color depending on which tab you were looking at. This module is
 * the single source of truth — dashboards should consume these exports
 * instead of hardcoding colors.
 *
 * Two shapes are exported for each concept because the two chart primitives
 * in this feature expect different value shapes:
 * - `PieChart` / `BarChart` set the value directly as an inline style / SVG
 *   `fill`, so they need a real CSS color (e.g. `hsl(var(--chart-2))`).
 * - `HorizontalBarChart` treats `color` as a Tailwind class name (it's
 *   threaded through `cn()`), so it needs a utility class (e.g. `bg-chart-2`).
 * Pick the export that matches the chart you're feeding.
 */

export type TaskStatus =
	| "completed"
	| "in_progress"
	| "not_started"
	| "on_hold"
	| "cancelled";

export type TaskPriority = "high" | "medium" | "low";

// Fallback color for "the rest"/"no data" buckets (an "Other" pie slice, an
// unset status, an empty state) — kept as one token so that concept also
// reads the same everywhere instead of each file repeating the literal.
export const NEUTRAL_COLOR = "hsl(var(--muted-foreground))";

// Task status -> CSS color, for PieChart/BarChart.
export const STATUS_COLORS: Record<TaskStatus, string> = {
	completed: "hsl(var(--success))",
	in_progress: "hsl(var(--chart-3))",
	not_started: NEUTRAL_COLOR,
	on_hold: "hsl(var(--chart-5))",
	cancelled: "hsl(var(--destructive))",
};

export const STATUS_LABELS: Record<TaskStatus, string> = {
	completed: "Completed",
	in_progress: "In Progress",
	not_started: "Not Started",
	on_hold: "On Hold",
	cancelled: "Cancelled",
};

// Task priority -> CSS color, for PieChart/BarChart. High/medium/low map to
// red/amber/blue, matching the convention already used for priority chips
// elsewhere in the app (e.g. src/features/tasks/components/task-item.tsx).
export const PRIORITY_COLORS: Record<TaskPriority, string> = {
	high: "hsl(var(--destructive))",
	medium: "hsl(var(--chart-5))",
	low: "hsl(var(--chart-3))",
};

export const PRIORITY_LABELS: Record<TaskPriority, string> = {
	high: "High",
	medium: "Medium",
	low: "Low",
};

// Ordered chart-series palette (5 slots) — CSS colors for PieChart/BarChart.
export const SERIES_COLORS = [
	"hsl(var(--chart-1))",
	"hsl(var(--chart-2))",
	"hsl(var(--chart-3))",
	"hsl(var(--chart-4))",
	"hsl(var(--chart-5))",
] as const;

/** Returns a series color, cycling through the 5 slots for index >= 5. */
export const seriesColor = (index: number): string =>
	SERIES_COLORS[index % SERIES_COLORS.length];

// Same 5-slot series palette as Tailwind utility classes, for
// HorizontalBarChart (which needs a class name, not a CSS color value).
export const SERIES_COLOR_CLASSES = [
	"bg-chart-1",
	"bg-chart-2",
	"bg-chart-3",
	"bg-chart-4",
	"bg-chart-5",
] as const;

/** Returns a series color class, cycling through the 5 slots for index >= 5. */
export const seriesColorClass = (index: number): string =>
	SERIES_COLOR_CLASSES[index % SERIES_COLOR_CLASSES.length];

// Single-hue sequential scale for magnitude/engagement tiers (e.g. "time
// spent" or "message length" buckets) — intensity via opacity rather than
// unrelated hues, since these are one measurement at different levels, not
// distinct categories.
export const INTENSITY_COLOR_CLASSES = {
	high: "bg-primary",
	medium: "bg-primary/60",
	low: "bg-primary/30",
} as const;

export const INTENSITY_COLORS = {
	high: "hsl(var(--primary))",
	medium: "hsl(var(--primary) / 60%)",
	low: "hsl(var(--primary) / 30%)",
} as const;
