"use client";

import { formatDistanceToNow } from "date-fns";
import { Clock, Hash, Loader, MessageSquareText } from "lucide-react";
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
import { WidgetCard } from "../shared/widget-card";

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

// Define the actual structure returned by the API
interface ThreadReplyMessage {
	message: {
		_id: Id<"messages">;
		_creationTime: number;
		body: string;
		memberId: Id<"members">;
		channelId?: Id<"channels">;
		parentMessageId?: Id<"messages">;
		workspaceId: Id<"workspaces">;
	};
	parentMessage: {
		_id: Id<"messages">;
		body: string;
	};
	parentUser: {
		name: string;
		image?: string;
		userId?: Id<"users">;
	};
	currentUser: {
		name: string;
		image?: string;
		userId?: Id<"users">;
	};
	context: {
		name: string;
		type: "channel" | "conversation";
		id: Id<"channels"> | Id<"conversations">;
	};
}

export const ThreadRepliesWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: ThreadRepliesWidgetProps) => {
	const router = useRouter();
	const rawThreadMessages = useGetThreadMessages();

	// Filter out threads with invalid data
	const threadMessages = rawThreadMessages
		? rawThreadMessages.filter(
				(thread) =>
					thread !== undefined &&
					thread !== null &&
					thread.message?._id !== undefined &&
					thread.context?.type === "channel" &&
					thread.message?.parentMessageId !== undefined
			)
		: null;

	// Define the type for a thread message
	type ThreadMessageType = NonNullable<typeof threadMessages>[0];

	// Get user IDs from thread messages for status tracking
	const userIds = useMemo(
		() =>
			threadMessages
				?.map((t) => t.currentUser?.userId)
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
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<MessageSquareText className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-semibold text-base">Thread Replies</h3>
					{!isEditMode && threadMessages.length > 0 && (
						<Badge
							className="ml-1 h-5 px-2 text-xs font-medium"
							variant="secondary"
						>
							{threadMessages.length}
						</Badge>
					)}
				</div>
				{isEditMode ? (
					controls
				) : (
					<Button
						className="h-8 text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
						onClick={() => router.push(`/workspace/${workspaceId}/threads`)}
						size="sm"
						variant="ghost"
					>
						View All
					</Button>
				)}
			</div>

			{threadMessages && threadMessages.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{threadMessages.map((thread) => {
							const authorUserId = thread.currentUser?.userId;
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
											{status && <PresenceIndicator status={status} />}
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
												<span className="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap flex items-center gap-0.5">
													<Clock className="h-2.5 w-2.5" />
													{(() => {
														try {
															// Try to safely format the date
															if (
																thread.message._creationTime &&
																!Number.isNaN(
																	Number(thread.message._creationTime)
																)
															) {
																const date = new Date(
																	Number(thread.message._creationTime)
																);
																if (date.toString() !== "Invalid Date") {
																	return formatDistanceToNow(date, {
																		addSuffix: true,
																	}).replace("about ", "");
																}
															}
															return "recently";
														} catch (_error) {
															return "recently";
														}
													})()}
												</span>
											</div>
											<div className="rounded-md bg-muted/30 p-2 text-xs">
												<p className="font-medium text-muted-foreground">
													Replied to your thread:
												</p>
												<p className="mt-1">
													{getMessagePreview(thread.message.body)}
													{thread.message.body.length > 50 ? "..." : ""}
												</p>
											</div>
											<Button
												className="mt-2 h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
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
				<div className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
					<MessageSquareText className="mb-3 h-12 w-12 text-muted-foreground/40" />
					<h3 className="text-base font-semibold text-foreground">
						No thread replies
					</h3>
					<p className="text-sm text-muted-foreground mt-1">
						You don't have any recent thread replies
					</p>
				</div>
			)}
		</div>
	);
};
