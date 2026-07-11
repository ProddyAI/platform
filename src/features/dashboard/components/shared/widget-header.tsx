import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface WidgetHeaderProps {
	/** Icon element, e.g. `<FileText className="size-5 text-primary" />`. */
	icon: React.ReactNode;
	title: string;
	/** Count badge content, e.g. `sortedItems.length`. Omit/undefined to hide it. */
	badge?: React.ReactNode;
	isEditMode?: boolean;
	/** Shown instead of `action` while `isEditMode` is true. */
	controls?: React.ReactNode;
	/** Shown instead of `controls` while `isEditMode` is false, e.g. a "View All" button. */
	action?: React.ReactNode;
	className?: string;
}

// Shared icon + title + count badge + action row used by every dashboard
// widget, matching the header convention widgets already share via WidgetCard.
export const WidgetHeader = ({
	icon,
	title,
	badge,
	isEditMode,
	controls,
	action,
	className,
}: WidgetHeaderProps) => {
	return (
		<div className={cn("flex items-center justify-between", className)}>
			<div className="flex items-center gap-2">
				{icon}
				<h3 className="font-semibold text-base">{title}</h3>
				{!isEditMode && badge != null && (
					<Badge
						className="ml-1 h-5 px-2 text-xs font-medium"
						variant="primarySoft"
					>
						{badge}
					</Badge>
				)}
			</div>
			{isEditMode ? controls : action}
		</div>
	);
};
