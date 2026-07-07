import { Clock } from "lucide-react";
import { safeFormatDistanceToNow } from "@/lib/date-utils";
import { cn } from "@/lib/utils";

interface RelativeTimeProps {
	timestamp: number | null | undefined;
	/** Prepended to the formatted time, e.g. "Last seen ". Ignored when `fallback` is used. */
	prefix?: string;
	/** Rendered instead of the formatted time when `timestamp` is falsy (e.g. "Offline"). */
	fallback?: string;
	/** Switches to destructive coloring — only pass true when genuinely overdue. */
	overdue?: boolean;
	addSuffix?: boolean;
	stripAbout?: boolean;
	className?: string;
	iconClassName?: string;
}

// Wraps the Clock icon + muted/destructive relative-time text pattern repeated
// across the dashboard widgets. `overdue` is opt-in so callers only get
// destructive-red coloring when a date is genuinely past due, not for every
// timestamp.
export const RelativeTime = ({
	timestamp,
	prefix,
	fallback,
	overdue,
	addSuffix = true,
	stripAbout = true,
	className,
	iconClassName,
}: RelativeTimeProps) => {
	const text =
		!timestamp && fallback
			? fallback
			: `${prefix ?? ""}${safeFormatDistanceToNow(timestamp, { addSuffix, stripAbout })}`;

	return (
		<span
			className={cn(
				"inline-flex items-center gap-1 whitespace-nowrap text-xs font-medium",
				overdue ? "text-destructive" : "text-muted-foreground",
				className
			)}
		>
			<Clock className={cn("shrink-0", iconClassName ?? "h-3 w-3")} />
			{text}
		</span>
	);
};
