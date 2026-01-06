"use client";

import type { LucideIcon } from "lucide-react";

import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";

type ToolButtonProps = {
	label: string;
	icon: LucideIcon;
	onClick: () => void;
	isActive?: boolean;
	isDisabled?: boolean;
	variant?: "default" | "danger";
};

export const ToolButton = ({
	label,
	icon: Icon,
	onClick,
	isActive,
	isDisabled,
	variant = "default",
}: ToolButtonProps) => {
	// Determine the button variant based on the props
	let buttonVariant: "default" | "destructive" | "secondary" = isActive
		? "secondary"
		: "default";

	// If danger variant is specified, use destructive style
	if (variant === "danger") {
		buttonVariant = "destructive";
	}

	return (
		<Hint label={label} side="right">
			<Button
				disabled={isDisabled}
				aria-disabled={isDisabled}
				onClick={onClick}
				size="icon"
				variant={buttonVariant}
			>
				<Icon />
			</Button>
		</Hint>
	);
};
