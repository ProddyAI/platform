import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface PageShellProps {
	children: ReactNode;
	className?: string;
	maxWidth?: "default" | "full";
}

// Soft-gray scroll container for content-first pages (dashboard, reports, usage,
// tasks, manage, calendar). The gray comes from the app `--background` token;
// cards inside read as raised white surfaces. NOT for full-bleed surfaces
// (chat, board, canvas, notes) — those manage their own layout.
export const PageShell = ({
	children,
	className,
	maxWidth = "default",
}: PageShellProps) => (
	<div className="h-full min-h-0 flex-1 overflow-y-auto custom-scrollbar bg-background">
		<div
			className={cn(
				"mx-auto w-full space-y-6 p-4 md:p-6",
				maxWidth !== "full" && "max-w-[1400px]",
				className
			)}
		>
			{children}
		</div>
	</div>
);
