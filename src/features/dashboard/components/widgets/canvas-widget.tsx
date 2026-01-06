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
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetChannels } from "@/features/channels/api/use-get-channels";

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
					<PenTool className="h-5 w-5 text-primary" />
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
					<Button
						variant="outline"
						size="sm"
						onClick={handleViewAll}
						className="border-2"
					>
						View All
					</Button>
				)}
			</div>

			{sortedCanvasItems.length > 0 ? (
				<ScrollArea className="h-[250px] rounded-md border-2 dark:bg-[hsl(var(--card-accent))]">
					<div className="space-y-2 p-4">
						{sortedCanvasItems.map((item) => (
							<Card
								key={item._id}
								className="overflow-hidden border-2 dark:bg-[hsl(var(--card-accent))] dark:border-[hsl(var(--border))]"
							>
								<CardContent className="p-3 dark:bg-[hsl(var(--card-accent))]">
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
											className="mt-1 w-full justify-start text-primary"
											onClick={() =>
												item.channelId &&
												handleViewCanvas(item._id, item.channelId, item.roomId)
											}
										>
											View canvas
										</Button>
									</div>
								</CardContent>
							</Card>
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
						variant="outline"
						size="sm"
						className="mt-4 border-2"
						onClick={handleCreateCanvas}
					>
						Create Canvas <Plus className="ml-2 h-3.5 w-3.5" />
					</Button>
				</div>
			)}
		</div>
	);
};
