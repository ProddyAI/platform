import { cva, type VariantProps } from "class-variance-authority";
import type * as React from "react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
	"inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				default:
					"border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
				secondary: "border-transparent bg-secondary/10 text-secondary",
				destructive:
					"border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
				success: "border-transparent bg-success/10 text-success",
				warning: "border-transparent bg-warning/10 text-warning",
				outline: "border-border text-foreground",
				primarySoft: "border-transparent bg-primary/10 text-primary",
				destructiveSoft:
					"border-transparent bg-destructive/10 text-destructive",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	}
);

export interface BadgeProps
	extends React.HTMLAttributes<HTMLDivElement>,
		VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
	return (
		<div className={cn(badgeVariants({ variant }), className)} {...props} />
	);
}

export { Badge, badgeVariants };
