"use client";

import { Fallback, Image, Root } from "@radix-ui/react-avatar";
import * as React from "react";

import { cn } from "@/lib/utils";

const Avatar = React.forwardRef<
	React.ElementRef<typeof Root>,
	React.ComponentPropsWithoutRef<typeof Root>
>(({ className, ...props }, ref) => (
	<Root
		className={cn(
			"relative flex size-10 shrink-0 overflow-hidden rounded-md transition-all duration-200",
			className
		)}
		ref={ref}
		{...props}
	/>
));
Avatar.displayName = Root.displayName;

const AvatarImage = React.forwardRef<
	React.ElementRef<typeof Image>,
	React.ComponentPropsWithoutRef<typeof Image>
>(({ className, ...props }, ref) => (
	<Image
		className={cn(
			"aspect-square size-full object-cover transition-opacity duration-200",
			className
		)}
		ref={ref}
		{...props}
	/>
));
AvatarImage.displayName = Image.displayName;

const AvatarFallback = React.forwardRef<
	React.ElementRef<typeof Fallback>,
	React.ComponentPropsWithoutRef<typeof Fallback>
>(({ className, ...props }, ref) => (
	<Fallback
		className={cn(
			"flex size-full items-center justify-center rounded-md bg-secondary text-sm font-semibold text-secondary-foreground transition-all duration-200",
			className
		)}
		ref={ref}
		{...props}
	/>
));
AvatarFallback.displayName = Fallback.displayName;

export { Avatar, AvatarFallback, AvatarImage };
