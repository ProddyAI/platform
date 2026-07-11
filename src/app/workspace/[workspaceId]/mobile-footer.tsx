"use client";

import {
	Bot,
	LayoutDashboard,
	Menu,
	MessageSquareText,
	Search,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

interface MobileFooterProps {
	onMenuClick: () => void;
}

export const MobileFooter = ({ onMenuClick }: MobileFooterProps) => {
	const workspaceId = useWorkspaceId();
	const pathname = usePathname();
	const [, setSearchOpen] = useWorkspaceSearch();

	const footerItems = [
		{
			icon: Menu,
			label: "Menu",
			href: "#",
			isActive: false,
			onClick: onMenuClick,
		},
		{
			icon: Bot,
			label: "Proddy AI",
			href: `/workspace/${workspaceId}/assistant`,
			isActive: pathname.includes("/assistant"),
			onClick: undefined,
		},
		{
			icon: LayoutDashboard,
			label: "Dashboard",
			href: `/workspace/${workspaceId}/dashboard`,
			isActive: pathname.includes("/dashboard"),
			onClick: undefined,
		},
		{
			icon: MessageSquareText,
			label: "Threads",
			href: `/workspace/${workspaceId}/threads`,
			isActive: pathname.includes("/threads"),
			onClick: undefined,
		},
		{
			icon: Search,
			label: "Search",
			href: "#",
			isActive: false,
			onClick: () => setSearchOpen(true),
		},
	];

	return (
		<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)] mobile-footer-safe">
			<nav className="flex items-center justify-around h-16 px-2">
				{footerItems.map((item) =>
					item.onClick ? (
						<button
							className={cn(
								"flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200",
								item.isActive
									? "text-primary bg-primary/10"
									: "text-muted-foreground hover:text-foreground hover:bg-muted"
							)}
							key={item.label}
							onClick={item.onClick}
							type="button"
						>
							<item.icon className="size-5" />
							<span
								className={cn(
									"text-[10px] font-medium transition-all duration-200",
									item.isActive && "font-semibold"
								)}
							>
								{item.label}
							</span>
						</button>
					) : (
						<Link
							className={cn(
								"flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200",
								item.isActive
									? "text-primary bg-primary/10"
									: "text-muted-foreground hover:text-foreground hover:bg-muted"
							)}
							href={item.href}
							key={item.label}
						>
							<item.icon className="size-5" />
							<span
								className={cn(
									"text-[10px] font-medium transition-all duration-200",
									item.isActive && "font-semibold"
								)}
							>
								{item.label}
							</span>
						</Link>
					)
				)}
			</nav>
		</div>
	);
};
