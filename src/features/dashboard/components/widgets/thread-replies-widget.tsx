"use client";

import { Hash, Loader, MessageSquareText } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetThreadMessages } from "@/features/messages/api/use-get-thread-messages";
import { PresenceIndicator } from "@/features/presence/components/presence-indicator";
import { useMultipleUserStatuses } from "@/features/presence/hooks/use-user-status";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

interface ThreadRepliesWidgetProps {
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

export const ThreadRepliesWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: ThreadRepliesWidgetProps) => {
	const router = useRouter();
	const rawThreadMessages = useGetThreadMessages();

	// Memoize threadMessages array to avoid recalculating on every render
	const threadMessages = useMemo(
		() =>
			rawThreadMessages
				? rawThreadMessages.filter(
						(thread) =>
							thread !== undefined &&
							thread !== null &&
							thread.message?._id !== undefined &&
							thread.context?.type === "channel" &&
							thread.message?.parentMessageId !== undefined
					)
				: null,
		[rawThreadMessages]
	);

	// Define the type for a thread message
	type ThreadMessageType = NonNullable<typeof threadMessages>[0];

	// Get user IDs from thread messages for status tracking
	const userIds = useMemo(
		() =>
			threadMessages
				?.map((t) => t.currentUser?._id)
				.filter((id): id is Id<"users"> => id !== undefined) || [],
		[threadMessages]
	);

	// Get statuses for all thread reply authors
	const { getUserStatus } = useMultipleUserStatuses(userIds, workspaceId);

	const handleViewThread = (thread: ThreadMessageType) => {
		if (thread.context.type === "channel" && thread.message.parentMessageId) {
			router.push(
				`/workspace/${workspaceId}/channel/${thread.context.id as Id<"channels">}/threads/${thread.message.parentMessageId}`
			);
		}
	};

	// Extract plain text from message body (which might be rich text)
	const getMessagePreview = (body: string) => {
		try {
			// If it's JSON (rich text), try to extract plain text
			const parsed = JSON.parse(body);
			if (parsed.ops) {
				return parsed.ops
					.map((op: { insert?: string | object }) =>
						typeof op.insert === "string" ? op.insert : ""
					)
					.join("")
					.trim()
					.substring(0, 50);
			}
			return body.substring(0, 50);
		} catch (_e) {
			// If not JSON, just return the string
			return body.substring(0, 50);
		}
	};

	if (!threadMessages) {
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
						onClick={() => router.push(`/workspace/${workspaceId}/threads`)}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				}
				badge={threadMessages.length > 0 ? threadMessages.length : undefined}
				controls={controls}
				icon={<MessageSquareText className="h-5 w-5 text-primary" />}
				isEditMode={isEditMode}
				title="Thread Replies"
			/>

			{threadMessages && threadMessages.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{threadMessages.map((thread) => {
							const authorUserId = thread.currentUser?._id;
							const status = authorUserId
								? getUserStatus(authorUserId)
								: undefined;

							return (
								<WidgetCard key={thread.message._id.toString()}>
									<div className="flex items-start gap-3">
										<div className="relative">
											<Avatar className="h-8 w-8">
												<AvatarImage
													alt={thread.currentUser.name || "User avatar"}
													src={thread.currentUser.image}
												/>
												<AvatarFallback>
													{thread.currentUser.name
														? thread.currentUser.name.charAt(0).toUpperCase()
														: "?"}
												</AvatarFallback>
											</Avatar>
											{status && status !== "offline" && (
												<PresenceIndicator status={status} />
											)}
										</div>
										<div className="flex-1 space-y-1">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="font-medium">
														{thread.currentUser.name || "Unknown User"}
													</p>
													{thread.context.type === "channel" && (
														<Badge
															className="flex items-center gap-1 border-2"
															variant="outline"
														>
															<Hash className="h-3 w-3" />
															{thread.context.name}
														</Badge>
													)}
												</div>
												<RelativeTime
													timestamp={thread.message._creationTime}
												/>
											</div>
											<div className="rounded-md bg-muted/30 p-2 text-xs">
												{(() => {
													const preview = getMessagePreview(
														thread.message.body
													);
													return (
														<>
															{preview}
															{preview.length >= 50 ? "..." : ""}
														</>
													);
												})()}
											</div>
											<Button
												className="mt-2 h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
												onClick={() => handleViewThread(thread)}
												size="sm"
												variant="ghost"
											>
												View thread
											</Button>
										</div>
									</div>
								</WidgetCard>
							);
						})}
					</div>
				</ScrollArea>
			) : (
				<WidgetEmptyState
					description="You don't have any recent thread replies"
					icon={MessageSquareText}
					title="No thread replies"
				/>
			)}
		</div>
	);
};
