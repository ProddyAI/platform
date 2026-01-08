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
		<div className="space-y-4 pb-4">
			<div className="flex items-center justify-between pr-2">
				<div className="flex items-center gap-2">
					<PenTool className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-medium">Recent Canvas</h3>
					{!isEditMode && sortedCanvasItems.length > 0 && (
						<Badge variant="default" className="ml-2">
							{sortedCanvasItems.length}
						</Badge>
					)}
				</div>
				{isEditMode ? (
					controls
				) : (
					<Button variant="default" size="sm" onClick={handleViewAll}>
						View All
					</Button>
				)}
			</div>

			{sortedCanvasItems.length > 0 ? (
				<ScrollArea className="widget-scroll-area">
					<div className="space-y-2 p-4">
						{sortedCanvasItems.map((item) => (
							<WidgetCard key={item._id}>
								<div className="space-y-1">
									<div className="flex items-center justify-between">
										<div className="flex items-center gap-2">
											<h5 className="font-medium">{item.title}</h5>
										</div>
										<div className="flex items-center text-xs text-muted-foreground">
											<Clock className="mr-1 h-3 w-3" />
											{formatDistanceToNow(new Date(item.updatedAt), {
												addSuffix: true,
											})}
										</div>
									</div>
									<Badge variant="outline" className="text-xs border-2">
										{item.channelName}
									</Badge>
									<p className="text-sm text-muted-foreground line-clamp-2">
										{item.description
											? item.description.substring(0, 100)
											: "No description"}
									</p>
									<Button
										variant="ghost"
										size="sm"
										className="mt-1 h-8 px-3 w-auto justify-start text-primary dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-600 hover:dark:bg-purple-400/10 hover:dark:text-purple-300"
										onClick={() =>
											item.channelId &&
											handleViewCanvas(item._id, item.channelId, item.roomId)
										}
									>
										View canvas
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
					<PenTool className="mb-2 h-10 w-10 text-muted-foreground" />
					<h3 className="text-lg font-medium">No canvas items found</h3>
					<p className="text-sm text-muted-foreground">
						Create a canvas to see it here
					</p>
					<Button
						variant="default"
						size="sm"
						className="mt-4 bg-primary/90 hover:bg-primary"
						onClick={handleCreateCanvas}
					>
						Create Canvas <Plus className="ml-2 h-3.5 w-3.5" />
					</Button>
				</div>
			)}
		</div>
	);
};
