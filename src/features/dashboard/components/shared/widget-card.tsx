import type { KeyboardEvent } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface WidgetCardProps {
	className?: string;
	contentClassName?: string;
	children: React.ReactNode;
	onClick?: () => void;
}

export const WidgetCard = ({
	className,
	contentClassName,
	children,
	onClick,
}: WidgetCardProps) => {
	const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
		if (!onClick) return;
		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onClick();
		}
	};

	return (
		<Card
			className={cn(
				"overflow-hidden",
				onClick &&
					"cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
				className
			)}
			interactive
			onClick={onClick}
			onKeyDown={handleKeyDown}
			role={onClick ? "button" : undefined}
			tabIndex={onClick ? 0 : undefined}
		>
			<CardContent className={cn("p-3", contentClassName)}>
				{children}
			</CardContent>
		</Card>
	);
};
