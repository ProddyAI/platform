import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateAction {
	label: string;
	onClick: () => void;
	icon?: LucideIcon;
}

interface EmptyStateProps {
	icon: LucideIcon;
	title: string;
	description?: string;
	action?: EmptyStateAction;
	size?: "sm" | "md";
	className?: string;
}

// Shared dashed-border empty state (icon + title + optional body + optional
// CTA). `md` matches the dashboard-widget height; `sm` sizes to content.
export const EmptyState = ({
	icon: Icon,
	title,
	description,
	action,
	size = "md",
	className,
}: EmptyStateProps) => {
	const ActionIcon = action?.icon;

	return (
		<div
			className={cn(
				"flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-muted/30 text-center",
				size === "md" ? "h-[250px] p-6" : "p-8",
				className
			)}
		>
			<Icon className="mb-3 size-10 text-muted-foreground/50" />
			<h3 className="text-sm font-semibold text-foreground">{title}</h3>
			{description && (
				<p className="mt-1 text-sm text-muted-foreground">{description}</p>
			)}
			{action && (
				<Button className="mt-4" onClick={action.onClick} size="sm">
					{ActionIcon && <ActionIcon className="mr-2 size-4" />}
					{action.label}
				</Button>
			)}
		</div>
	);
};
