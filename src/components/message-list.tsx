import { differenceInMinutes, format, isToday, isYesterday } from "date-fns";
import { Loader, Sparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { ContextMenuProvider } from "@/features/chats/contexts/context-menu-context";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import type { GetMessagesReturnType } from "@/features/messages/api/use-get-messages";
import { DailyRecapModal } from "@/features/smart/components/daily-recap-modal";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { Id } from "../../convex/_generated/dataModel";
import { ChannelHero } from "./channel-hero";
import { ConversationHero } from "./conversation-hero";
import { Hint } from "./hint";
import { Message } from "./message";
import { Button } from "./ui/button";

const TIME_THRESHOLD = 15;

interface MessageListProps {
	memberName?: string;
	memberImage?: string;
	channelName?: string;
	channelCreationTime?: number;
	variant?: "channel" | "thread" | "conversation";
	data: GetMessagesReturnType | undefined;
	loadMore: () => void;
	isLoadingMore: boolean;
	canLoadMore: boolean;
}

const formatDateLabel = (dateStr: string) => {
	const date = new Date(dateStr);

	if (isToday(date)) return "Today";
	if (isYesterday(date)) return "Yesterday";

	return format(date, "EEEE, MMMM d");
};

export const MessageList = ({
	memberName,
	memberImage,
	channelName,
	channelCreationTime,
	data,
	variant = "channel",
	loadMore,
	isLoadingMore,
	canLoadMore,
}: MessageListProps) => {
	const [editingId, setEditingId] = useState<Id<"messages"> | null>(null);
	const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
	const [recapData, setRecapData] = useState<{
		recap: string;
		date: string;
		messageCount: number;
		isCached?: boolean;
	} | null>(null);
	const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);

	const workspaceId = useWorkspaceId();

	const { data: currentMember } = useCurrentMember({ workspaceId });

	const groupedMessages = data?.reduce(
		(groups, message) => {
			const date = new Date(message._creationTime);
			const dateKey = format(date, "yyyy-MM-dd");

			if (!groups[dateKey]) {
				groups[dateKey] = [];
			}

			groups[dateKey].unshift(message);

			return groups;
		},
		{} as Record<string, typeof data>
	);

	const handleGenerateRecap = async (
		dateKey: string,
		messages: typeof data
	) => {
		if (!messages || messages.length === 0 || isGeneratingRecap) return;

		setIsGeneratingRecap(true);

		try {
			// Show loading toast
			const loadingToast = toast.loading("Generating daily recap...", {
				duration: 10000,
			});

			// Format messages for the API
			const formattedMessages = messages.map((message) => ({
				id: message._id,
				body: message.body,
				authorName: message.user.name,
				creationTime: message._creationTime,
			}));

			// Send request to the API
			const response = await fetch("/api/smart/dailyrecap", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					messages: formattedMessages,
					date: dateKey,
					channelName,
				}),
			});

			// Dismiss loading toast
			toast.dismiss(loadingToast);

			if (!response.ok) {
				const errorData = await response.json().catch(() => ({}));
				throw new Error(errorData.error || "Failed to generate daily recap");
			}

			const data = await response.json();

			// Set recap data and open modal
			setRecapData({
				recap: data.recap,
				date: dateKey,
				messageCount: messages.length,
				isCached: Boolean(data.cached),
			});
			setIsRecapModalOpen(true);

			// Show a small toast notification
			toast.success(
				data.cached
					? "Recap retrieved from cache"
					: "Daily recap generated successfully"
			);
		} catch (error) {
			console.error("Error generating daily recap:", error);
			toast.error("Failed to generate daily recap. Please try again.");
		} finally {
			setIsGeneratingRecap(false);
		}
	};

	return (
		<ContextMenuProvider>
			<div className="messages-scrollbar flex flex-1 flex-col-reverse overflow-y-auto pb-4">
				{recapData && (
					<DailyRecapModal
						date={recapData.date}
						isCached={recapData.isCached}
						isOpen={isRecapModalOpen}
						messageCount={recapData.messageCount}
						onClose={() => setIsRecapModalOpen(false)}
						recap={recapData.recap}
					/>
				)}

				{Object.entries(groupedMessages || {}).map(([dateKey, messages]) => (
					<div key={dateKey}>
						<div className="relative my-4 flex items-center justify-center">
							<div className="absolute left-0 right-0 h-px bg-border" />

							<div className="relative flex items-center gap-2 bg-background px-4 dark:bg-[hsl(var(--background))]">
								<span className="inline-block rounded-full border border-border bg-card px-4 py-1 text-xs shadow-sm dark:bg-[hsl(var(--card))]">
									{formatDateLabel(dateKey)}
								</span>

								<Hint label="Generate daily recap">
									<Button
										className="h-6 px-2 rounded-full bg-card border border-border shadow-sm hover:bg-accent text-foreground dark:text-gray-300 dark:bg-[hsl(var(--card))] dark:border-border dark:hover:bg-slate-700"
										disabled={isGeneratingRecap}
										onClick={() => handleGenerateRecap(dateKey, messages)}
										size="sm"
										variant="ghost"
									>
										<Sparkles className="size-3 text-amber-500 dark:text-amber-400 mr-1" />
										<span className="text-xs font-medium text-amber-600 dark:text-amber-400">
											Recap
										</span>
									</Button>
								</Hint>
							</div>
						</div>

						{messages.map((message, i) => {
							const prevMessage = messages[i - 1];
							const isCompact =
								prevMessage &&
								prevMessage.user._id === message.user._id &&
								differenceInMinutes(
									new Date(message._creationTime),
									new Date(prevMessage._creationTime)
								) < TIME_THRESHOLD;

							return (
								<Message
									authorImage={message.user.image}
									authorName={message.user.name}
									body={message.body}
									calendarEvent={message.calendarEvent}
									createdAt={message._creationTime}
									hideThreadButton={variant === "thread"}
									id={message._id}
									image={message.image}
									isAuthor={message.memberId === currentMember?._id}
									isCompact={isCompact}
									isEditing={editingId === message._id}
									key={message._id}
									memberId={message.memberId}
									reactions={message.reactions}
									setEditingId={setEditingId}
									threadCount={message.threadCount}
									threadImage={message.threadImage}
									threadName={message.threadName}
									threadTimestamp={message.threadTimestamp}
									updatedAt={message.updatedAt}
								/>
							);
						})}
					</div>
				))}

				<div
					className="h-1"
					ref={(el) => {
						if (el) {
							const observer = new IntersectionObserver(
								([entry]) => {
									if (entry.isIntersecting && canLoadMore) loadMore();
								},
								{ threshold: 1.0 }
							);

							observer.observe(el);

							return () => observer.disconnect();
						}
					}}
				/>

				{isLoadingMore && (
					<div className="relative my-4 flex items-center justify-center">
						<div className="absolute left-0 right-0 h-px bg-border" />

						<span className="relative inline-block rounded-full border border-border bg-card px-4 py-1 text-xs shadow-sm dark:bg-[hsl(var(--card))]">
							<Loader className="size-4 animate-spin text-foreground" />
						</span>
					</div>
				)}

				{variant === "channel" && channelName && channelCreationTime && (
					<ChannelHero creationTime={channelCreationTime} name={channelName} />
				)}
				{variant === "conversation" && (
					<ConversationHero image={memberImage} name={memberName} />
				)}
			</div>
		</ContextMenuProvider>
	);
};
