"use client";

import { ChevronDown } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

interface AccordionItemProps {
	title: string;
	children: React.ReactNode;
	isOpen?: boolean;
	onToggle?: () => void;
	className?: string;
}

export const AccordionItem = ({
	title,
	children,
	isOpen = false,
	onToggle,
	className,
}: AccordionItemProps) => {
	const [open, setOpen] = React.useState(isOpen);

	const handleToggle = () => {
		const newState = !open;
		setOpen(newState);
		if (onToggle) onToggle();
	};

	return (
		<div
			className={cn(
				"border border-gray-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-all duration-300",
				className
			)}
		>
			<button
				type="button"
				className={cn(
					"flex w-full items-center justify-between px-6 py-5 text-left transition-all duration-300",
					open
						? "bg-primary/5 border-b border-gray-200"
						: "bg-white hover:bg-gray-50"
				)}
				onClick={handleToggle}
			>
				<h3
					className={cn(
						"text-lg font-semibold transition-colors duration-300",
						open ? "text-primary" : "text-gray-900"
					)}
				>
					{title}
				</h3>
				<ChevronDown
					className={cn(
						"h-5 w-5 transition-all duration-300",
						open ? "rotate-180 text-primary" : "text-gray-500"
					)}
				/>
			</button>
			<div
				className={cn(
					"overflow-hidden transition-all duration-300 ease-in-out",
					open ? "max-h-96" : "max-h-0"
				)}
			>
				<div className="px-6 py-5 bg-white text-gray-600 leading-relaxed">
					{children}
				</div>
			</div>
		</div>
	);
};

interface AccordionProps {
	children: React.ReactNode;
	className?: string;
}

export const Accordion = ({ children, className }: AccordionProps) => {
	return <div className={cn("space-y-4", className)}>{children}</div>;
};
