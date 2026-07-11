"use client";

import { useQuery } from "convex/react";
import { Loader, PenTool, Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

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

interface CanvasItem {
	_id: Id<"messages">;
	title: string;
	updatedAt: number;
	channelId?: Id<"channels">;
	channelName: string;
	roomId?: string;
}

export const CanvasWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: CanvasWidgetProps) => {
	const router = useRouter();
	const { data: channels } = useGetChannels({ workspaceId });

	// Canvases are scoped to the first channel only; the heading and
	// navigation below reflect that scope rather than implying workspace-wide data.
	const firstChannel =
		channels && channels.length > 0 ? channels[0] : undefined;
	const firstChannelId = firstChannel?._id;

	// Get messages from the channel to find canvas items
	const messages = useQuery(
		api.messaging.messages.get,
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
		if (!channels || !messages?.page) return [];

		const canvasMessages: CanvasItem[] = [];

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
			<WidgetHeader
				action={
					<Button
						className="h-8 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
						onClick={handleViewAll}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				}
				badge={
					sortedCanvasItems.length > 0 ? sortedCanvasItems.length : undefined
				}
				controls={controls}
				icon={<PenTool className="size-5 text-primary" />}
				isEditMode={isEditMode}
				title={
					firstChannel ? `Canvases in #${firstChannel.name}` : "Recent Canvases"
				}
			/>

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
										<RelativeTime
											className="text-[10px]"
											iconClassName="size-2.5"
											timestamp={item.updatedAt}
										/>
									</div>
									<div className="flex items-center gap-2">
										<Badge className="h-5 px-2 text-xs" variant="outline">
											# {item.channelName}
										</Badge>
									</div>
									<Button
										className="h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
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
				<WidgetEmptyState
					action={{
						label: "Create Canvas",
						onClick: handleCreateCanvas,
						icon: Plus,
					}}
					description="Create a canvas to see it here"
					icon={PenTool}
					title="No canvas items found"
				/>
			)}
		</div>
	);
};
