"use client";

import {
	Calendar,
	FileText,
	Kanban,
	LayoutDashboard,
	MessageSquare,
	Palette,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface TestNavigationProps {
	variant?: "header" | "compact";
	className?: string;
}

export const TestNavigation = ({
	variant = "header",
	className,
}: TestNavigationProps) => {
	const router = useRouter();
	const pathname = usePathname();

	const navigationItems = [
		{ name: "Dashboard", icon: LayoutDashboard, path: "/mockup/dashboard" },
		{ name: "Calendar", icon: Calendar, path: "/mockup/calendar" },
		{ name: "Board", icon: Kanban, path: "/mockup/board" },
		{ name: "Notes", icon: FileText, path: "/mockup/notes" },
		{ name: "Canvas", icon: Palette, path: "/mockup/canvas" },
		{ name: "Chats", icon: MessageSquare, path: "/mockup/chats" },
	];

	const isActive = (path: string) => pathname === path;

	if (variant === "compact") {
		return (
			<div className={cn("flex items-center gap-1", className)}>
				{navigationItems.map((item) => {
					const Icon = item.icon;
					const active = isActive(item.path);

					return (
						<Button
							key={item.name}
							variant={active ? "default" : "ghost"}
							size="sm"
							onClick={() => router.push(item.path)}
							className={cn(
								"text-white hover:bg-white/10 transition-standard",
								active && "bg-white/20"
							)}
						>
							<Icon className="h-4 w-4 mr-2" />
							{item.name}
						</Button>
					);
				})}
			</div>
		);
	}

	return (
		<div className={cn("flex items-center gap-2", className)}>
			{navigationItems.map((item) => {
				const Icon = item.icon;
				const active = isActive(item.path);

				return (
					<Button
						key={item.name}
						variant={active ? "default" : "ghost"}
						size="sm"
						onClick={() => router.push(item.path)}
						className={cn(
							"text-white hover:bg-white/10 transition-standard",
							active && "bg-white/20"
						)}
					>
						<Icon className="h-4 w-4 mr-2" />
						{item.name}
					</Button>
				);
			})}
		</div>
	);
};
