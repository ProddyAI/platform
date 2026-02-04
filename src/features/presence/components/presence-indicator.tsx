"use client";

import { cn } from "@/lib/utils";

export type UserStatus = "online" | "idle" | "dnd" | "offline" | "hidden";

interface PresenceIndicatorProps {
	status?: UserStatus;
	isOnline?: boolean; // Backward compatibility
	className?: string;
}

export const PresenceIndicator = ({
	status,
	isOnline,
	className,
}: PresenceIndicatorProps) => {
	// Backward compatibility: if isOnline is provided, use it
	const displayStatus = status || (isOnline ? "online" : "offline");

	// Don't show indicator if status is hidden (tracking disabled)
	if (displayStatus === "hidden") {
		return null;
	}

	const statusColors = {
		online: "bg-green-500",
		idle: "bg-yellow-500",
		dnd: "bg-red-500",
		offline: "bg-gray-400",
		hidden: "",
	};

	return (
		<div
			className={cn(
				"absolute bottom-0 right-0 size-2.5 rounded-full border-2 border-white",
				statusColors[displayStatus],
				className
			)}
		/>
	);
};
