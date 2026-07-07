import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface WidgetEmptyStateAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
}

interface WidgetEmptyStateProps {
	icon: LucideIcon;
	title: string;
	description: string;
	action?: WidgetEmptyStateAction;
	className?: string;
}

// Shared dashed-border empty state (icon + title + body + optional CTA) used
// whenever a widget has nothing to show.
export const WidgetEmptyState = ({
	icon: Icon,
	title,
	description,
	action,
	className,
}: WidgetEmptyStateProps) => {
	const ActionIcon = action?.icon;

	return (
		<div
			className={cn(
				"flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5",
				className
			)}
		>
			<Icon className="mb-3 h-12 w-12 text-muted-foreground/40" />
			<h3 className="text-base font-semibold text-foreground">{title}</h3>
			<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			{action && (
				<Button
					className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-purple-600 dark:hover:bg-purple-700"
					onClick={action.onClick}
					size="sm"
					variant="default"
				>
					{ActionIcon && <ActionIcon className="mr-2 h-4 w-4" />}
					{action.label}
				</Button>
			)}
		</div>
	);
};
