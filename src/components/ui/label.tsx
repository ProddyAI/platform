"use client";

import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const labelVariants = cva(
	"text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
);

interface LabelProps
	extends React.LabelHTMLAttributes<HTMLLabelElement>,
		VariantProps<typeof labelVariants> {}

const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
	({ className, ...props }, ref) => (
		<label className={cn(labelVariants(), className)} ref={ref} {...props} />
	)
);
Label.displayName = "Label";

export { Label };
