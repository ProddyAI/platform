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
import { Hint } from "@/components/hint";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";

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
		<div className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-primary border-t border-border/20 shadow-[0_-2px_10px_rgba(0,0,0,0.1)] dark:shadow-[0_-2px_10px_rgba(0,0,0,0.3)] mobile-footer-safe">
			<nav className="flex items-center justify-around h-16 px-2">
				{footerItems.map((item) =>
					item.onClick ? (
						<button
							className={cn(
								"flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-lg transition-all duration-200",
								item.isActive
									? "text-secondary-foreground bg-secondary-foreground/20"
									: "text-secondary-foreground/60 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
							)}
							key={item.label}
							onClick={item.onClick}
							type="button"
						>
							<item.icon
								className={cn(
									"size-5 transition-transform duration-200",
									item.isActive && "scale-110"
								)}
							/>
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
									? "text-secondary-foreground bg-secondary-foreground/20"
									: "text-secondary-foreground/60 hover:text-secondary-foreground hover:bg-secondary-foreground/10"
							)}
							href={item.href}
							key={item.label}
						>
							<item.icon
								className={cn(
									"size-5 transition-transform duration-200",
									item.isActive && "scale-110"
								)}
							/>
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
