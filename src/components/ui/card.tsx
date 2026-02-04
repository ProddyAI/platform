import * as React from "react";

import { cn } from "@/lib/utils";

const Card = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn(
			"rounded-lg border bg-card text-card-foreground shadow-sm",
			className
		)}
		ref={ref}
		{...props}
	/>
));
Card.displayName = "Card";

const CardHeader = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn("flex flex-col space-y-1.5 p-6", className)}
		ref={ref}
		{...props}
	/>
));
CardHeader.displayName = "CardHeader";

type CardTitleProps<T extends React.ElementType = "h3"> = {
	as?: T;
	className?: string;
} & React.ComponentPropsWithoutRef<T>;

const CardTitle = React.forwardRef(
	<T extends React.ElementType = "h3">(
		{ as, className, ...props }: CardTitleProps<T>,
		ref: React.ForwardedRef<HTMLHeadingElement>
	) => {
		const Element = as || "h3";
		return (
			<Element
				className={cn(
					"text-2xl font-semibold leading-none tracking-tight",
					className
				)}
				ref={ref}
				{...props}
			/>
		);
	}
) as <T extends React.ElementType = "h3">(
	props: CardTitleProps<T> & { ref?: React.ForwardedRef<HTMLHeadingElement> }
) => React.ReactElement;

// Set displayName using Object.defineProperty for polymorphic component
Object.defineProperty(CardTitle, "displayName", {
	value: "CardTitle",
	writable: false,
});

const CardDescription = React.forwardRef<
	HTMLParagraphElement,
	React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
	<p
		className={cn("text-sm text-muted-foreground", className)}
		ref={ref}
		{...props}
	/>
));
CardDescription.displayName = "CardDescription";

const CardContent = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div className={cn("p-6 pt-0", className)} ref={ref} {...props} />
));
CardContent.displayName = "CardContent";

const CardFooter = React.forwardRef<
	HTMLDivElement,
	React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
	<div
		className={cn("flex items-center p-6 pt-0", className)}
		ref={ref}
		{...props}
	/>
));
CardFooter.displayName = "CardFooter";

export {
	Card,
	CardHeader,
	CardFooter,
	CardTitle,
	CardDescription,
	CardContent,
};
