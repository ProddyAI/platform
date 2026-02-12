"use client";

import { Minus, Moon } from "lucide-react";
import type { UserStatus } from "@/../convex/userStatus";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type { UserStatus };

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
	};

	const statusLabels = {
		online: "Online",
		idle: "Idle",
		dnd: "Do Not Disturb",
		offline: "Offline",
	};

	const renderIcon = () => {
		switch (displayStatus) {
			case "dnd":
				return (
					<Minus
						className="size-2 text-gray-700 dark:text-gray-800 translate-x-[0.5px]"
						strokeWidth={3}
					/>
				);
			default:
				return null;
		}
	};

	// Simple crescent moon icon for idle status
	if (displayStatus === "idle") {
		return (
			<TooltipProvider delayDuration={300}>
				<Tooltip>
					<TooltipTrigger asChild>
						<div
							className={cn(
								"absolute -bottom-0.5 -right-0.5 cursor-default",
								className
							)}
						>
							<Moon className="size-3 text-yellow-500 fill-yellow-500" strokeWidth={0} />
						</div>
					</TooltipTrigger>
					<TooltipContent className="text-xs" side="top">
						{statusLabels[displayStatus]}
					</TooltipContent>
				</Tooltip>
			</TooltipProvider>
		);
	}

	return (
		<TooltipProvider delayDuration={300}>
			<Tooltip>
				<TooltipTrigger asChild>
					<div
						className={cn(
							"absolute -bottom-0.5 -right-0.5 size-3 rounded-full flex items-center justify-center border border-gray-300/50 dark:border-gray-600/50 cursor-default",
							statusColors[displayStatus],
							className
						)}
					>
						{renderIcon()}
					</div>
				</TooltipTrigger>
				<TooltipContent className="text-xs" side="top">
					{statusLabels[displayStatus]}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
