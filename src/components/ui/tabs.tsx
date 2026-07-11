"use client";

import { Content, List, Root, Trigger } from "@radix-ui/react-tabs";
import * as React from "react";

import { cn } from "@/lib/utils";

const Tabs = Root;

const TabsList = React.forwardRef<
	React.ElementRef<typeof List>,
	React.ComponentPropsWithoutRef<typeof List>
>(({ className, ...props }, ref) => (
	<List
		className={cn(
			"inline-flex h-10 items-center justify-center rounded-full bg-muted p-1 text-muted-foreground",
			className
		)}
		ref={ref}
		{...props}
	/>
));
TabsList.displayName = List.displayName;

const TabsTrigger = React.forwardRef<
	React.ElementRef<typeof Trigger>,
	React.ComponentPropsWithoutRef<typeof Trigger>
>(({ className, ...props }, ref) => (
	<Trigger
		className={cn(
			"inline-flex items-center justify-center whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium ring-offset-background transition-colors duration-fast focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-card data-[state=active]:text-foreground data-[state=active]:shadow-sm",
			className
		)}
		ref={ref}
		{...props}
	/>
));
TabsTrigger.displayName = Trigger.displayName;

const TabsContent = React.forwardRef<
	React.ElementRef<typeof Content>,
	React.ComponentPropsWithoutRef<typeof Content>
>(({ className, ...props }, ref) => (
	<Content
		className={cn(
			"mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			className
		)}
		ref={ref}
		{...props}
	/>
));
TabsContent.displayName = Content.displayName;

export { Tabs, TabsContent, TabsList, TabsTrigger };
