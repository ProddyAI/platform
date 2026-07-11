"use client";

import { LayoutGrid, MessageSquare } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// Removed Tabs import to use simpler navigation
// import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

const Topbar = () => {
	const pathname = usePathname();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();

	const tabs = [
		{
			label: "Chat",
			icon: MessageSquare,
			href: `/workspace/${workspaceId}/channel/${channelId}/chats`,
			active: pathname.includes(`/channel/${channelId}/chats`),
		},
		{
			label: "Boards",
			icon: LayoutGrid,
			href: `/workspace/${workspaceId}/channel/${channelId}/board`,
			active: pathname.includes(`/channel/${channelId}/board`),
		},
	];

	return (
		<div className="channel-topbar flex w-full min-w-0 max-w-full overflow-x-hidden items-center justify-center border-b border-border bg-card px-2 py-1.5 md:px-4 md:py-2">
			<div className="flex h-9 md:h-10 w-full max-w-full min-w-0 items-center gap-1 rounded-full bg-muted p-1 relative z-10">
				{tabs.map((tab, _index) => {
					const Icon = tab.icon;

					return (
						<Link
							className={cn(
								"flex h-full flex-1 min-w-0 items-center justify-center gap-1.5 rounded-full px-1 sm:px-4 text-sm font-medium text-muted-foreground transition-standard hover:text-foreground",
								tab.active && "bg-card text-foreground shadow-sm"
							)}
							href={tab.href}
							key={tab.href}
						>
							<Icon
								className={cn(
									"size-4 md:h-5 md:w-5 flex-shrink-0",
									tab.active && "text-primary"
								)}
							/>
							<span className="hidden sm:inline-block text-xs md:text-sm">
								{tab.label}
							</span>
						</Link>
					);
				})}
			</div>
		</div>
	);
};

export default Topbar;
