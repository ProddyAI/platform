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
		value={value}
		{...props}
	>
		<ProgressPrimitiveIndicator
			className="size-full flex-1 bg-secondary transition-all data-[state=indeterminate]:animate-pulse motion-reduce:data-[state=indeterminate]:animate-none"
			style={
				value == null
					? undefined
					: { transform: `translateX(-${100 - value}%)` }
			}
		/>
	</ProgressPrimitiveRoot>
));
Progress.displayName = ProgressPrimitiveRoot.displayName;

export { Progress };
