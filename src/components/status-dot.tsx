import { cn } from "@/lib/utils";

export type StatusTone =
	| "success"
	| "warning"
	| "destructive"
	| "neutral"
	| "primary";

interface StatusDotProps {
	tone: StatusTone;
	label?: string;
	className?: string;
}

const TONE_DOT: Record<StatusTone, string> = {
	success: "bg-success",
	warning: "bg-warning",
	destructive: "bg-destructive",
	neutral: "bg-muted-foreground/40",
	primary: "bg-primary",
};

// Small colored dot + optional label — the canonical "● Success" table/status
// cell. Meaning is carried by the label, not color alone.
export const StatusDot = ({ tone, label, className }: StatusDotProps) => (
	<span
		className={cn(
			"inline-flex items-center gap-1.5 text-xs font-medium text-foreground",
			className
		)}
	>
		<span className={cn("size-1.5 rounded-full", TONE_DOT[tone])} />
		{label}
	</span>
);
