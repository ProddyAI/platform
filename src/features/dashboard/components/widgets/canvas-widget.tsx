"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import { Clock, Loader, PenTool, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { WidgetCard } from "../shared/widget-card";

interface CanvasWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const CanvasWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: CanvasWidgetProps) => {
	const router = useRouter();
	const { data: channels } = useGetChannels({ workspaceId });

	// Get boards from the first channel (for simplicity)
	const firstChannelId =
		channels && channels.length > 0 ? channels[0]._id : undefined;

	// Get messages from the channel to find canvas items
	const messages = useQuery(
		api.messages.get,
		firstChannelId
			? {
					channelId: firstChannelId,
					paginationOpts: {
						numItems: 100,
						cursor: null,
					},
				}
			: "skip"
	);

	// Extract canvas items from messages
	const canvasItems = useMemo(() => {
		if (!channels || !messages || !messages.page) return [];

		const canvasMessages = [];

		// Filter messages to find canvas-related messages
		for (const message of messages.page) {
			try {
				const body = JSON.parse(message.body);

				// Look for messages with canvas type
				if (body && (body.type === "canvas" || body.type === "canvas-live")) {
					const channel = channels.find((c) => c._id === message.channelId);
					canvasMessages.push({
						_id: message._id,
						title: body.canvasName || "Untitled Canvas",
						description: "Collaborative whiteboard canvas",
						updatedAt: message._creationTime,
						channelId: message.channelId,
						channelName: channel?.name || "Unknown Channel",
						roomId: body.roomId,
					});
				}
			} catch (_e) {
				// Not a JSON message or not a canvas message, skip
			}
		}

		return canvasMessages;
	}, [channels, messages]);

	// Sort canvas items by last updated time
	const sortedCanvasItems = useMemo(() => {
		if (!canvasItems.length) return [];

		return [...canvasItems]
			.sort((a, b) => {
				// Sort by last updated time (creation time in this case)
				return b.updatedAt - a.updatedAt;
			})
			.slice(0, 10); // Limit to 10 items
	}, [canvasItems]);

	const handleViewCanvas = (
		_messageId: Id<"messages">,
		channelId: Id<"channels">,
		roomId?: string
	) => {
		if (roomId) {
			router.push(
				`/workspace/${workspaceId}/channel/${channelId}/canvas?roomId=${roomId}`
			);
		} else {
			router.push(`/workspace/${workspaceId}/channel/${channelId}/canvas`);
		}
	};

	const handleCreateCanvas = () => {
		// Navigate to the first channel's canvas section
		if (channels && channels.length > 0) {
			router.push(
				`/workspace/${workspaceId}/channel/${channels[0]._id}/canvas?new=true`
			);
		}
	};

	// View all canvas button handler
	const handleViewAll = () => {
		// Navigate to the first channel's canvas section
		if (channels && channels.length > 0) {
			router.push(
				`/workspace/${workspaceId}/channel/${channels[0]._id}/canvas`
			);
		}
	};

	if (!channels) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<PenTool className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-semibold text-base">Recent Canvases</h3>
					{!isEditMode && sortedCanvasItems.length > 0 && (
						<Badge
							className="ml-1 h-5 px-2 text-xs font-medium"
							variant="secondary"
						>
							{sortedCanvasItems.length}
						</Badge>
					)}
				</div>
				{isEditMode ? (
					controls
				) : (
					<Button
						className="h-8 text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
						onClick={handleViewAll}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				)}
			</div>

			{sortedCanvasItems.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedCanvasItems.map((item) => (
							<WidgetCard key={item._id}>
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<h5 className="font-medium text-sm leading-tight flex-1">
											{item.title}
										</h5>
										<span className="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap flex items-center gap-0.5">
											<Clock className="h-2.5 w-2.5" />
											{formatDistanceToNow(new Date(item.updatedAt), {
												addSuffix: true,
											}).replace("about ", "")}
										</span>
									</div>
									<div className="flex items-center gap-2">
										<Badge
											className="text-xs h-5 px-2 border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300"
											variant="outline"
										>
											# {item.channelName}
										</Badge>
									</div>
									<p className="text-xs text-muted-foreground line-clamp-1">
										{item.description}
									</p>
									<Button
										className="h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
										onClick={() =>
											item.channelId &&
											handleViewCanvas(item._id, item.channelId, item.roomId)
										}
										size="sm"
										variant="ghost"
									>
										View canvas
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
					<PenTool className="mb-3 h-12 w-12 text-muted-foreground/40" />
					<h3 className="text-base font-semibold text-foreground">
						No canvas items found
					</h3>
					<p className="text-sm text-muted-foreground mt-1">
						Create a canvas to see it here
					</p>
					<Button
						className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-purple-600 dark:hover:bg-purple-700"
						onClick={handleCreateCanvas}
						size="sm"
						variant="default"
					>
						<Plus className="mr-2 h-4 w-4" />
						Create Canvas
					</Button>
				</div>
			)}
		</div>
	);
};
