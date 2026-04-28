"use client";

import { LayoutGrid, MessageSquare, Video } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

import { HuddleModal } from "@/components/meet/HuddleModal";
import { Button } from "@/components/ui/button";
// Removed Tabs import to use simpler navigation
// import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

const Topbar = () => {
	const pathname = usePathname();
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const [isHuddleOpen, setIsHuddleOpen] = useState(false);

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
		<>
			<div className="channel-topbar flex w-full min-w-0 max-w-full items-center justify-between gap-3 overflow-x-hidden border-b border-border bg-card px-3 py-2 shadow-sm">
				<div
					className="grid h-10 min-w-0 flex-1 max-w-full relative z-10 bg-card p-0 md:h-12"
					style={{
						gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))`,
					}}
				>
					{tabs.map((tab) => {
						const Icon = tab.icon;

						return (
							<Link
								className={cn(
									"flex h-full min-w-0 flex-1 items-center justify-center border-b-2 border-transparent px-1 py-2 text-muted-foreground text-sm font-medium opacity-100 transition-all hover:bg-muted/30 hover:text-foreground sm:px-4 md:py-3",
									tab.active &&
										"border-secondary bg-secondary/5 text-secondary hover:bg-secondary/10"
								)}
								href={tab.href}
								key={tab.href}
							>
								<Icon
									className={cn(
										"h-4 w-4 flex-shrink-0 md:h-5 md:w-5",
										tab.active && "text-secondary"
									)}
								/>
								<span className="ml-1.5 hidden text-xs sm:inline-block md:ml-2 md:text-sm">
									{tab.label}
								</span>
							</Link>
						);
					})}
				</div>

				<Button
					className="shrink-0"
					onClick={() => setIsHuddleOpen(true)}
					size="sm"
					type="button"
				>
					<Video className="mr-2 h-4 w-4" />
					Start meeting
				</Button>
			</div>
			<HuddleModal
				channelId={channelId}
				onOpenChange={setIsHuddleOpen}
				open={isHuddleOpen}
				workspaceId={workspaceId}
			/>
		</>
	);
};

export default Topbar;
