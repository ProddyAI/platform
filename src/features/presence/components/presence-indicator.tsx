"use client";

import { cn } from "@/lib/utils";

interface PresenceIndicatorProps {
	isOnline: boolean;
	className?: string;
}

export const PresenceIndicator = ({
	isOnline,
	className,
}: PresenceIndicatorProps) => {
	return (
		<div
			className={cn(
				"absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white",
				isOnline ? "bg-green-500" : "bg-gray-400",
				className
			)}
		/>
	);
};
