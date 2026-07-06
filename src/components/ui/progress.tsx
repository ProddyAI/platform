"use client";

import {
	Indicator as ProgressPrimitiveIndicator,
	Root as ProgressPrimitiveRoot,
} from "@radix-ui/react-progress";
import * as React from "react";

import { cn } from "@/lib/utils";

const Progress = React.forwardRef<
	React.ElementRef<typeof ProgressPrimitiveRoot>,
	React.ComponentPropsWithoutRef<typeof ProgressPrimitiveRoot>
>(({ className, value, ...props }, ref) => (
	<ProgressPrimitiveRoot
		className={cn(
			"relative h-4 w-full overflow-hidden rounded-full bg-secondary/20 dark:bg-secondary/10",
			className
		)}
		ref={ref}
		{...props}
	>
		<ProgressPrimitiveIndicator
			className="h-full w-full flex-1 bg-gradient-to-r from-pink-500 to-pink-600 dark:from-pink-400 dark:to-pink-500 transition-all"
			style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
		/>
	</ProgressPrimitiveRoot>
));
Progress.displayName = ProgressPrimitiveRoot.displayName;

export { Progress };
