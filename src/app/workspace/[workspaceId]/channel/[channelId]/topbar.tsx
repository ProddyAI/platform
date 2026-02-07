"use client";

import { FileText, LayoutGrid, MessageSquare, PaintBucket } from "lucide-react";
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
			label: "Canvas",
			icon: PaintBucket,
			href: `/workspace/${workspaceId}/channel/${channelId}/canvas`,
			active: pathname.includes(`/channel/${channelId}/canvas`),
		},
		{
			label: "Notes",
			icon: FileText,
			href: `/workspace/${workspaceId}/channel/${channelId}/notes`,
			active: pathname.includes(`/channel/${channelId}/notes`),
		},
		{
			label: "Boards",
			icon: LayoutGrid,
			href: `/workspace/${workspaceId}/channel/${channelId}/board`,
			active: pathname.includes(`/channel/${channelId}/board`),
		},
	];

	// Determine the current active tab value
	const _activeTab =
		tabs
			.find((tab) => tab.active)
			?.href.split("/")
			.pop() || "chats";

	return (
		<div className="channel-topbar flex w-full items-center justify-center border-b bg-white shadow-sm">
			<div className="grid h-10 md:h-12 w-full grid-cols-4 bg-white p-0 relative z-10 min-w-0">
				{tabs.map((tab, _index) => {
					const Icon = tab.icon;

					return (
						<Link
							className={cn(
								"flex h-full items-center justify-center border-b-2 border-transparent px-1 sm:px-4 py-2 md:py-3 text-sm font-medium text-muted-foreground transition-all hover:bg-muted/30 hover:text-foreground opacity-100 visible flex-1 min-w-0",
								tab.active &&
									"border-secondary text-secondary bg-secondary/5 hover:bg-secondary/10"
							)}
							href={tab.href}
							key={tab.href}
						>
							<Icon className={cn(
								"h-4 w-4 md:h-5 md:w-5 flex-shrink-0",
								tab.active && "text-secondary"
							)} />
							<span className="hidden sm:inline-block ml-1.5 md:ml-2 text-xs md:text-sm">
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
