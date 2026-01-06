import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-[10px] text-sm font-medium ring-offset-background transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]",
	{
		variants: {
			variant: {
				default:
					"bg-secondary text-secondary-foreground hover:bg-secondary/90 shadow-md hover:shadow-lg",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-md hover:shadow-lg",
				outline:
					"border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-secondary/50",
				secondary:
					"bg-secondary text-secondary-foreground hover:bg-secondary/80 shadow-md hover:shadow-lg",
				primary:
					"bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg",
				ghost: "hover:bg-accent/50 hover:text-accent-foreground",
				link: "text-secondary underline-offset-4 hover:underline",
				transparent: "bg-transparent hover:bg-accent/10 text-accent",
				glass:
					"bg-white/10 backdrop-blur-md border border-white/20 text-white hover:bg-white/20 shadow-md hover:shadow-lg",
			},
			size: {
				default: "h-10 px-4 py-2",
				sm: "h-8 rounded-[10px] px-3",
				lg: "h-11 rounded-[10px] px-8",
				icon: "h-10 w-10",
				iconSm: "h-8 w-8",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	}
);

export interface ButtonProps
	extends React.ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {
	asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, asChild = false, ...props }, ref) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				className={cn(buttonVariants({ variant, size, className }))}
				ref={ref}
				{...props}
			/>
		);
	}
);
Button.displayName = "Button";

export { Button, buttonVariants };
