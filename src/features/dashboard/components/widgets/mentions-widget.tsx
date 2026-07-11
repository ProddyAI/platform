"use client";

import { AtSign, CheckCircle, Hash } from "lucide-react";
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
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";
import { WidgetLoading } from "../shared/widget-loading";

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
		(): Mention[] =>
			rawMentions
				? rawMentions.filter(
						(mention): mention is NonNullable<typeof mention> =>
							mention !== undefined && mention !== null
					)
				: ([] as Mention[]),
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
		return <WidgetLoading />;
	}

	return (
		<div className="space-y-3">
			<WidgetHeader
				action={
					counts &&
					counts.total > 0 && (
						<Button
							className="h-8 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
							onClick={handleMarkAllAsRead}
							size="sm"
							variant="ghost"
						>
							<CheckCircle className="mr-2 size-4" />
							Mark all as read
						</Button>
					)
				}
				badge={counts && counts.total > 0 ? counts.total : undefined}
				controls={controls}
				icon={<AtSign className="size-5 text-primary" />}
				isEditMode={isEditMode}
				title="Mentions"
			/>

			{mentions && mentions.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{mentions.map((mention) => {
							const authorUserId = mention.author.userId;
							const status = authorUserId
								? getUserStatus(authorUserId)
								: undefined;

							return (
								<WidgetCard key={mention.id}>
									<div className="flex items-start gap-3">
										<div className="relative">
											<Avatar className="size-8">
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
											{status && status !== "offline" && (
												<PresenceIndicator status={status} />
											)}
										</div>
										<div className="flex-1 space-y-1">
											<div className="flex items-center justify-between">
												<div className="flex min-w-0 items-center gap-2">
													<p className="truncate font-medium">
														{mention.author.name || "Unknown User"}
													</p>
													{mention.source.type === "channel" && (
														<Badge
															className="flex shrink-0 items-center gap-1 border-2"
															variant="outline"
														>
															<Hash className="size-3" />
															{mention.source.name}
														</Badge>
													)}
												</div>
												<RelativeTime
													className="shrink-0"
													timestamp={mention.timestamp}
												/>
											</div>
											<p className="text-sm text-muted-foreground">
												{(() => {
													const preview = getMessagePreview(mention.text);
													return (
														<>
															{preview}
															{preview.length >= 50 ? "..." : ""}
														</>
													);
												})()}
											</p>
											<Button
												className="mt-2 h-7 w-full justify-center px-2 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
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
				<WidgetEmptyState
					description="You haven't been mentioned recently"
					icon={AtSign}
					title="No mentions"
				/>
			)}
		</div>
	);
};
