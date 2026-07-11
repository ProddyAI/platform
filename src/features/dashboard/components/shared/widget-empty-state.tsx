import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/empty-state";

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

// Thin wrapper preserving the widget call-site API; delegates to the shared
// EmptyState (md size matches the widget height).
export const WidgetEmptyState = ({
	icon,
	title,
	description,
	action,
	className,
}: WidgetEmptyStateProps) => (
	<EmptyState
		action={action}
		className={className}
		description={description}
		icon={icon}
		size="md"
		title={title}
	/>
);
