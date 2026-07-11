import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import * as React from "react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
	"inline-flex items-center justify-center whitespace-nowrap rounded-full text-sm font-medium ring-offset-background transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] motion-reduce:active:scale-100",
	{
		variants: {
			variant: {
				default: "bg-primary text-primary-foreground hover:bg-primary/90",
				destructive:
					"bg-destructive text-destructive-foreground hover:bg-destructive/90",
				outline: "border border-border bg-card text-foreground hover:bg-muted",
				secondary: "bg-muted text-foreground hover:bg-muted/70",
				// Deprecated alias of `default`, kept only so existing call sites
				// passing variant="primary" keep working. Use `default` in new code.
				primary: "bg-primary text-primary-foreground hover:bg-primary/90",
				ghost: "hover:bg-muted/60 hover:text-foreground",
				link: "text-primary underline-offset-4 hover:underline",
				transparent: "bg-transparent hover:bg-accent/10 text-foreground",
			},
			size: {
				default: "h-10 px-5 py-2",
				sm: "h-8 px-3.5",
				lg: "h-11 px-6",
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
	loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			className,
			variant,
			size,
			asChild = false,
			loading = false,
			disabled,
			children,
			...props
		},
		ref
	) => {
		const Comp = asChild ? Slot : "button";
		return (
			<Comp
				aria-busy={loading || undefined}
				className={cn(buttonVariants({ variant, size, className }))}
				disabled={disabled || loading}
				ref={ref}
				{...props}
			>
				{asChild ? (
					children
				) : (
					<>
						{loading ? (
							<Loader2
								aria-hidden="true"
								className="mr-2 h-4 w-4 animate-spin"
							/>
						) : null}
						{children}
					</>
				)}
			</Comp>
		);
	}
);
Button.displayName = "Button";

export { Button, buttonVariants };
