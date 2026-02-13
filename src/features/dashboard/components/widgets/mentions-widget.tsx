"use client";

import { formatDistanceToNow } from "date-fns";
import { AtSign, CheckCircle, Clock, Hash, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetMentionedMessages } from "@/features/messages/api/use-get-mentioned-messages";
import { useGetUnreadMentionsCount } from "@/features/messages/api/use-get-unread-mentions-count";
import { useMarkAllMentionsAsRead } from "@/features/messages/api/use-mark-all-mentions-as-read";
import { useMarkMentionAsRead } from "@/features/messages/api/use-mark-mention-as-read";
import { PresenceIndicator } from "@/features/presence/components/presence-indicator";
import { useMultipleUserStatuses } from "@/features/presence/hooks/use-user-status";
import { WidgetCard } from "../shared/widget-card";

interface MentionsWidgetProps {
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

interface Mention {
	id: Id<"mentions">;
	messageId?: Id<"messages">;
	cardId?: Id<"cards">;
	text: string;
	timestamp: number;
	read: boolean;
	author: {
		id: Id<"members">;
		userId: Id<"users">;
		name: string;
		image?: string;
	};
	source: {
		type: "channel" | "direct" | "thread" | "card";
		id:
			| Id<"channels">
			| Id<"conversations">
			| Id<"messages">
			| Id<"cards">
			| string;
		name: string;
	};
}

export const MentionsWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: MentionsWidgetProps) => {
	const router = useRouter();
	const { data: rawMentions, isLoading } = useGetMentionedMessages(false); // false to get only unread
	const { counts, isLoading: countsLoading } = useGetUnreadMentionsCount();
	const markAsRead = useMarkMentionAsRead();
	const markAllAsRead = useMarkAllMentionsAsRead();

	// Memoize mentions array to avoid recalculating on every render
	const mentions = useMemo(
		() =>
			rawMentions
				? rawMentions.filter(
						(mention): mention is NonNullable<typeof mention> =>
							mention !== undefined && mention !== null
					)
				: [],
		[rawMentions]
	);

	// Get user IDs from mentions for status tracking
	const userIds = useMemo(
		() =>
			mentions
				.map((m) => m.author?.userId)
				.filter((id): id is Id<"users"> => id !== undefined),
		[mentions]
	);

	// Get statuses for all mentioned users
	const { getUserStatus } = useMultipleUserStatuses(userIds, workspaceId);

	const handleViewMention = (mention: Mention) => {
		// Mark as read
		markAsRead(mention.id);

		// Navigate based on mention type
		if (mention.source.type === "channel") {
			router.push(
				`/workspace/${workspaceId}/channel/${mention.source.id}/chats`
			);
		} else if (mention.source.type === "direct") {
			router.push(
				`/workspace/${workspaceId}/conversation/${mention.source.id}`
			);
		} else if (mention.source.type === "thread" && mention.messageId) {
			router.push(`/workspace/${workspaceId}/thread/${mention.messageId}`);
		} else if (mention.source.type === "card" && mention.cardId) {
			router.push(`/workspace/${workspaceId}/card/${mention.cardId}`);
		}
	};

	const handleMarkAllAsRead = async () => {
		await markAllAsRead();
	};

	// Extract plain text from message body (which might be rich text)
	const getMessagePreview = (text: string) => {
		try {
			// If it's JSON (rich text), try to extract plain text
			const parsed = JSON.parse(text);
			if (parsed.ops) {
				return parsed.ops
					.map((op: { insert?: string | object }) =>
						typeof op.insert === "string" ? op.insert : ""
					)
					.join("")
					.trim()
					.substring(0, 50);
			}
			return text.substring(0, 50);
		} catch (_e) {
			// If not JSON, just return the string
			return text.substring(0, 50);
		}
	};

	if (isLoading || countsLoading) {
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
					<AtSign className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-medium">Mentions</h3>
					{!isEditMode && counts && counts.total > 0 && (
						<Badge className="ml-2" variant="default">
							{counts.total}
						</Badge>
					)}
				</div>
				{isEditMode
					? controls
					: counts &&
						counts.total > 0 && (
							<Button onClick={handleMarkAllAsRead} size="sm" variant="default">
								<CheckCircle className="mr-2 h-4 w-4" />
								Mark all as read
							</Button>
						)}
			</div>

			{mentions && mentions.length > 0 ? (
				<ScrollArea className="widget-scroll-area">
					<div className="space-y-2 p-4">
						{mentions.map((mention) => {
							const authorUserId = mention.author.userId;
							const status = authorUserId
								? getUserStatus(authorUserId)
								: undefined;

							return (
								<WidgetCard key={mention.id}>
									<div className="flex items-start gap-3">
										<div className="relative">
											<Avatar className="h-8 w-8">
												<AvatarImage
													alt={mention.author.name || "User avatar"}
													src={mention.author.image}
												/>
												<AvatarFallback>
													{mention.author.name
														? mention.author.name.charAt(0).toUpperCase()
														: "?"}
												</AvatarFallback>
											</Avatar>
											{status && <PresenceIndicator status={status} />}
										</div>
										<div className="flex-1 space-y-1">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="font-medium">
														{mention.author.name || "Unknown User"}
													</p>
													{mention.source.type === "channel" && (
														<Badge
															className="flex items-center gap-1 border-2"
															variant="outline"
														>
															<Hash className="h-3 w-3" />
															{mention.source.name}
														</Badge>
													)}
												</div>
												<div className="flex items-center text-xs text-red-600 dark:text-red-400 font-medium">
													<Clock className="mr-1 h-3 w-3" />
													{(() => {
														try {
															// Try to safely format the date
															if (
																mention.timestamp &&
																!Number.isNaN(Number(mention.timestamp))
															) {
																const date = new Date(
																	Number(mention.timestamp)
																);
																if (date.toString() !== "Invalid Date") {
																	return formatDistanceToNow(date, {
																		addSuffix: true,
																	});
																}
															}
															return "recently";
														} catch (_error) {
															return "recently";
														}
													})()}
												</div>
											</div>
											<p className="text-sm text-muted-foreground">
												{(() => {
													const preview = getMessagePreview(mention.text);
													return (
														<>
															{preview}
															{preview.length === 50 ? "..." : ""}
														</>
													);
												})()}
											</p>
											<Button
												className="mt-2 h-8 px-3 w-auto justify-start text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
												onClick={() => handleViewMention(mention)}
												size="sm"
												variant="ghost"
											>
												View mention
											</Button>
										</div>
									</div>
								</WidgetCard>
							);
						})}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
					<AtSign className="mb-2 h-10 w-10 text-muted-foreground" />
					<h3 className="text-lg font-medium">No mentions</h3>
					<p className="text-sm text-muted-foreground">
						You haven't been mentioned recently
					</p>
				</div>
			)}
		</div>
	);
};
