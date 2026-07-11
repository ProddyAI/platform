"use client";

import { cn } from "@/lib/utils";

interface TypingIndicatorProps {
	typingText?: string;
	isVisible: boolean;
	className?: string;
}

export const TypingIndicator = ({
	typingText = "",
	isVisible,
	className,
}: TypingIndicatorProps) => {
	if (!isVisible) return null;

	return (
		<div
			className={cn(
				"flex items-center gap-2 px-5 py-1 text-sm italic text-muted-foreground",
				"animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none",
				className
			)}
		>
			<div className="flex gap-1">
				<span
					className="size-1.5 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
					style={{ animationDelay: "0ms" }}
				/>
				<span
					className="size-1.5 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
					style={{ animationDelay: "200ms" }}
				/>
				<span
					className="size-1.5 rounded-full bg-muted-foreground animate-pulse motion-reduce:animate-none"
					style={{ animationDelay: "400ms" }}
				/>
			</div>
			<span>{typingText}</span>
		</div>
	);
};
