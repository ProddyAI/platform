import type { LucideIcon } from "lucide-react";
import { Minus, TrendingDown, TrendingUp } from "lucide-react";
import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type DeltaVisual = {
	Icon: LucideIcon;
	chipClass: string;
	label: string;
};

// Shared delta styling so a positive/negative/flat change always renders the
// same icon and soft-tinted chip everywhere it appears. A 0% change reads as
// neutral rather than a false-positive green "up" arrow.
export const getDeltaVisual = (change: number): DeltaVisual => {
	const label = `${Math.abs(change)}%`;

	if (change > 0) {
		return {
			Icon: TrendingUp,
			chipClass: "bg-success/10 text-success",
			label,
		};
	}

	if (change < 0) {
		return {
			Icon: TrendingDown,
			chipClass: "bg-destructive/10 text-destructive",
			label,
		};
	}

	return { Icon: Minus, chipClass: "bg-muted text-muted-foreground", label };
};

interface StatCardProps {
	label: string;
	value: ReactNode;
	delta?: number;
	deltaLabel?: string;
	icon?: LucideIcon;
	action?: ReactNode;
	className?: string;
}

// Fintech-style stat tile: label + big numeral + optional delta chip. Renders
// on a white card so delta chips keep AA contrast against the tint.
export const StatCard = ({
	label,
	value,
	delta,
	deltaLabel,
	icon: Icon,
	action,
	className,
}: StatCardProps) => {
	const deltaVisual = delta !== undefined ? getDeltaVisual(delta) : null;

	return (
		<Card className={cn("p-5", className)}>
			<div className="flex items-start justify-between gap-2">
				<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
					{Icon && <Icon className="size-4" />}
					{label}
				</div>
				{action}
			</div>

			<div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
				{value}
			</div>

			{deltaVisual && (
				<div className="mt-2 flex items-center gap-2">
					<span
						className={cn(
							"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
							deltaVisual.chipClass
						)}
					>
						<deltaVisual.Icon className="size-3" />
						{deltaVisual.label}
					</span>
					{deltaLabel && (
						<span className="text-xs text-muted-foreground">{deltaLabel}</span>
					)}
				</div>
			)}
		</Card>
	);
};
