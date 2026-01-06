"use client";

import type { PropsWithChildren } from "react";

import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface HintProps {
	label: string;
	side?: "top" | "right" | "bottom" | "left";
	align?: "start" | "center" | "end";
}

export const Hint = ({
	label,
	children,
	side = "top",
	align = "center",
}: PropsWithChildren<HintProps>) => {
	return (
		<TooltipProvider delayDuration={0} skipDelayDuration={0}>
			<Tooltip>
				<TooltipTrigger asChild>{children}</TooltipTrigger>
				<TooltipContent
					side={side}
					align={align}
					className="border border-white/5 bg-black text-white"
					sideOffset={8}
				>
					<p className="text-xs font-medium">{label}</p>
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
};
