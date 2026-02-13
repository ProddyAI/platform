"use client";

import { formatDistanceToNow } from "date-fns";
import {
	AlertTriangle,
	AtSign,
	Bell,
	CheckCircle2,
	Clock,
	Eye,
	Filter,
	Hash,
	LayoutGrid,
	Loader,
	MessageSquare,
	User,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetDirectMessages } from "@/features/messages/api/use-get-direct-messages";
import { useGetMentionedMessages } from "@/features/messages/api/use-get-mentioned-messages";
import { useMarkAllDirectMessagesAsRead } from "@/features/messages/api/use-mark-all-direct-messages-as-read";
import { useMarkAllMentionsAsRead } from "@/features/messages/api/use-mark-all-mentions-as-read";
import { useMarkDirectMessageAsRead } from "@/features/messages/api/use-mark-direct-message-as-read";
import { useMarkMentionAsRead } from "@/features/messages/api/use-mark-mention-as-read";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useAdBlockerDetectionContext } from "@/lib/ad-blocker-context";
import { Alert, AlertDescription } from "@/components/ui/alert";
	import { Badge } from "@/components/ui/badge";

interface MentionsNotificationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

export const MentionsNotificationDialog = ({
	open,
	onOpenChange,
}: MentionsNotificationDialogProps) => {
	const _router = useRouter();
	const workspaceId = useWorkspaceId();
	const { data: mentions, isLoading: isLoadingMentions } =
		useGetMentionedMessages(true); // Get all mentions
	const { data: directMessages, isLoading: isLoadingDirectMessages } =
		useGetDirectMessages(true); // Get all direct messages
	const markMentionAsRead = useMarkMentionAsRead();
	const markDirectMessageAsRead = useMarkDirectMessageAsRead();
	const markAllMentionsAsReadMutation = useMarkAllMentionsAsRead();
	const markAllDirectMessagesAsReadMutation = useMarkAllDirectMessagesAsRead();
	const [activeTab, setActiveTab] = useState("all");
	const { isAdBlockerActive } = useAdBlockerDetectionContext();

	// Combine mentions and direct messages
	const allNotifications = [
		...(mentions || []).map((mention: any) => ({
			...mention,
			type: "mention",
		})),
		...(directMessages || []).map((message: any) => ({
			...message,
			type: "direct",
		})),
	];

	// Sort by timestamp (newest first)
	allNotifications.sort((a: any, b: any) => b.timestamp - a.timestamp);

	const isLoading = isLoadingMentions || isLoadingDirectMessages;

	const handleToggleReadStatus = async (notification: any) => {
		if (notification.type === "mention") {
			await markMentionAsRead(
				notification.id as Id<"mentions">,
				!notification.read
			);
		} else if (notification.type === "direct") {
			await markDirectMessageAsRead(notification.messageId);
		}
	};

	const handleMarkAllAsRead = async () => {
		// Mark all mentions as read
		await markAllMentionsAsReadMutation();

		// Mark all direct messages as read
		await markAllDirectMessagesAsReadMutation();
	};

	const formatRelativeTime = (timestamp: number) => {
		try {
			return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
		} catch (_error) {
			return "Unknown time";
		}
	};

	const getSourceIcon = (type: string) => {
		switch (type) {
			case "channel":
				return <Hash className="size-4 text-blue-500" />;
			case "direct":
				return <User className="size-4 text-green-500" />;
			case "thread":
				return <MessageSquare className="size-4 text-purple-500" />;
			case "card":
				return <LayoutGrid className="size-4 text-amber-500" />;
			default:
				return <AtSign className="size-4 text-gray-500" />;
		}
	};

	const getSourceLink = (mention: any) => {
		// Safety check: ensure mention has source with type and id
		if (!mention?.source?.type || !mention?.source?.id) {
			return `/workspace/${workspaceId}`;
		}

		switch (mention.source.type) {
			case "channel":
				return `/workspace/${workspaceId}/channel/${mention.source.id}`;
			case "direct":
				return `/workspace/${workspaceId}/member/${mention.source.id}`;
			case "thread":
				return `/workspace/${workspaceId}/channel/${mention.source.id}`;
			case "card":
				// For cards, we link to the channel's board page
				return `/workspace/${workspaceId}/channel/${mention.source.id}/board`;
			default:
				return `/workspace/${workspaceId}`;
		}
	};

	// Filter notifications based on active tab
	const filteredNotifications = allNotifications.filter((notification: any) => {
		// Check if the notification has the required properties
		if (!notification) return false;

		if (activeTab === "all") return true;
		if (activeTab === "unread") return !notification.read;

		if (activeTab === "direct") {
			// For the direct tab, show both direct messages and mentions in direct chats
			if (notification.type === "direct") return true;
			if (
				notification.type === "mention" &&
				notification.source &&
				notification.source.type === "direct"
			)
				return true;
			return false;
		}

		// For other tabs, only show mentions of that type
		return (
			notification.type === "mention" &&
			notification.source &&
			notification.source.type === activeTab
		);
	});

	// Count unread notifications by type
	const unreadCounts = {
		all: allNotifications.filter((n: any) => !n.read).length || 0,
		channel:
			allNotifications.filter(
				(n: any) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "channel"
			).length || 0,
		direct:
			allNotifications.filter(
				(n: any) =>
					(n.type === "direct" && !n.read) ||
					(n.type === "mention" &&
						!n.read &&
						n.source &&
						n.source.type === "direct")
			).length || 0,
		thread:
			allNotifications.filter(
				(n: any) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "thread"
			).length || 0,
		card:
			allNotifications.filter(
				(n: any) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "card"
			).length || 0,
	};

	const renderNotificationsList = (notificationsList: any[]) => (
		<div className="divide-y divide-border/20 dark:divide-border/10 max-h-[450px] overflow-y-auto">
			{notificationsList?.length === 0 ? (
				<div className="flex h-[250px] w-full flex-col items-center justify-center gap-y-3 bg-gray-50 dark:bg-gray-900/50">
					{activeTab === "unread" ? (
						<>
							<div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
								<CheckCircle2 className="size-10 text-green-500 dark:text-green-400" />
							</div>
							<h2 className="text-xl font-semibold dark:text-gray-100">
								All caught up!
							</h2>
							<p className="text-sm text-muted-foreground dark:text-gray-400">
								You have no unread notifications
							</p>
						</>
					) : activeTab === "all" ? (
						<>
							<div className="rounded-full bg-blue-100 dark:bg-blue-900/30 p-3">
								<Bell className="size-10 text-blue-500 dark:text-blue-400" />
							</div>
							<h2 className="text-xl font-semibold dark:text-gray-100">
								No notifications yet
							</h2>
							<p className="text-sm text-muted-foreground dark:text-gray-400">
								When you receive notifications, they will appear here
							</p>
						</>
					) : activeTab === "direct" ? (
						<>
							<div className="rounded-full bg-green-100 dark:bg-green-900/30 p-3">
								<MessageSquare className="size-10 text-green-500 dark:text-green-400" />
							</div>
							<h2 className="text-xl font-semibold dark:text-gray-100">
								No direct messages
							</h2>
							<p className="text-sm text-muted-foreground dark:text-gray-400">
								When someone sends you a direct message, it will appear here
							</p>
						</>
					) : (
						<>
							<div className="rounded-full bg-gray-100 dark:bg-gray-800 p-3">
								<Filter className="size-10 text-gray-500 dark:text-gray-400" />
							</div>
							<h2 className="text-xl font-semibold dark:text-gray-100">
								No {activeTab} notifications
							</h2>
							<p className="text-sm text-muted-foreground dark:text-gray-400">
								Try checking other categories
							</p>
						</>
					)}
				</div>
			) : (
				notificationsList?.map((notification: any) => {
					// Determine if this is a direct message or a mention
					const isDirect = notification.type === "direct";

					// Get the appropriate link with fallback to workspace
					const link = isDirect
						? notification.author?.id
							? `/workspace/${workspaceId}/member/${notification.author.id}`
							: `/workspace/${workspaceId}`
						: getSourceLink(notification);

					// Skip rendering if we don't have a valid link
					if (!link) return null;

					return (
						<Link
							className={`block p-4 transition-colors hover:bg-gray-50 dark:hover:bg-gray-800/50 ${!notification.read ? "bg-blue-50 dark:bg-blue-900/20" : "bg-white dark:bg-gray-900"} relative group`}
							href={link}
							key={notification.id}
							onClick={() => onOpenChange(false)}
						>
							<div className="flex items-start gap-3">
								<Avatar className="h-10 w-10 border dark:border-gray-700">
									<AvatarImage src={notification.author.image} />
									<AvatarFallback className="bg-secondary/10 dark:bg-secondary/20 text-secondary dark:text-secondary-foreground font-medium">
										{notification.author.name.charAt(0)}
									</AvatarFallback>
								</Avatar>

								<div className="flex-1 space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-semibold dark:text-gray-100">
											{notification.author.name}
										</span>
										<div className="flex items-center gap-1 text-xs text-muted-foreground dark:text-gray-400">
											<Clock className="size-3.5" />
											<span>{formatRelativeTime(notification.timestamp)}</span>
										</div>

										{/* Source badge - different for direct messages */}
										<div className="ml-auto flex items-center gap-1.5 rounded-full bg-gray-100 dark:bg-gray-800 px-2.5 py-1 text-xs font-medium dark:text-gray-300">
											{isDirect ? (
												<MessageSquare className="size-4 text-green-500 dark:text-green-400" />
											) : (
												getSourceIcon(notification.source.type)
											)}
											<span>
												{isDirect ? "Direct Message" : notification.source.name}
											</span>
										</div>
									</div>

									<p className="text-sm leading-relaxed mb-3 dark:text-gray-300">
										{notification.text}
									</p>

									{/* Read/Unread toggle button at the bottom */}
									<div className="flex justify-end mt-1">
										<button
											className={`flex items-center gap-1.5 text-xs font-medium rounded px-2.5 py-1.5 transition-colors ${
												notification.read
													? "text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 bg-blue-50 dark:bg-blue-900/30 hover:bg-blue-100 dark:hover:bg-blue-900/40"
													: "text-green-600 dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/40"
											}`}
											onClick={(e) => {
												e.preventDefault(); // Prevent navigation
												e.stopPropagation(); // Prevent event bubbling
												handleToggleReadStatus(notification);
											}}
										>
											{notification.read ? (
												<>
													<Eye className="size-3.5" />
													Mark as unread
												</>
											) : (
												<>
													<CheckCircle2 className="size-3.5" />
													Mark as read
												</>
											)}
										</button>
									</div>

									{/* Border separator below the button */}
									<div className="border-t border-border/10 dark:border-gray-700/50 mt-2" />
								</div>
							</div>
						</Link>
					);
				})
			)}
		</div>
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="sm:max-w-[550px] p-0 overflow-hidden shadow-lg [&>button]:hidden dark:bg-gray-900 dark:border-gray-800">
				<DialogHeader className="p-5 border-b bg-white dark:bg-gray-900 border-gray-200 dark:border-gray-800 space-y-3">
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2 text-xl dark:text-gray-100">
							<div className="bg-blue-100 dark:bg-blue-900/40 p-1.5 rounded-full">
								<Bell className="size-5 text-blue-600 dark:text-blue-400" />
							</div>
							<span>Notifications</span>
							{unreadCounts.all > 0 && (
								<Badge
									className="ml-2 bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700"
									variant="default"
								>
									{unreadCounts.all} new
								</Badge>
							)}
						</DialogTitle>
						{unreadCounts.all > 0 && (
							<Button
								className="text-xs gap-1.5 border-blue-200 dark:border-blue-800 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300"
								onClick={handleMarkAllAsRead}
								size="sm"
								variant="outline"
							>
								<CheckCircle2 className="size-3.5" />
								Mark all as read
							</Button>
						)}
					</div>

					{/* Ad Blocker Warning */}
					{isAdBlockerActive && (
						<Alert className="border-red-200 bg-red-50 dark:bg-red-950/20 dark:border-red-800">
							<AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
							<AlertDescription className="text-red-700 dark:text-red-300 text-sm">
								Notifications may be blocked by your browser or network settings
							</AlertDescription>
						</Alert>
					)}
				</DialogHeader>

				{isLoading ? (
					<div className="flex h-[300px] w-full items-center justify-center bg-gray-50 dark:bg-gray-900/50">
						<div className="flex flex-col items-center gap-3">
							<Loader className="size-8 animate-spin text-secondary dark:text-secondary-foreground" />
							<p className="text-sm text-muted-foreground dark:text-gray-400">
								Loading your mentions...
							</p>
						</div>
					</div>
				) : (
					<Tabs
						className="w-full"
						defaultValue="all"
						onValueChange={setActiveTab}
						value={activeTab}
					>
						<div className="border-b px-4 py-3 bg-gray-50 dark:bg-gray-900 border-gray-200 dark:border-gray-800">
							<TabsList className="grid w-full grid-cols-5 p-1 bg-gray-100 dark:bg-gray-800 rounded-lg dark:border dark:border-gray-700">
								<TabsTrigger
									className="relative py-1.5 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border data-[state=active]:border-secondary/20 dark:data-[state=active]:border-gray-600 dark:text-gray-300 dark:data-[state=active]:text-gray-100"
									value="all"
								>
									<div className="flex items-center gap-1.5">
										<Filter className="size-3.5" />
										<span>All</span>
									</div>
									{unreadCounts.all > 0 && (
										<Badge
											className="absolute -top-2 right-0 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 shadow-sm"
											variant="default"
										>
											{unreadCounts.all}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger
									className="relative py-1.5 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border data-[state=active]:border-secondary/20 dark:data-[state=active]:border-gray-600 dark:text-gray-300 dark:data-[state=active]:text-gray-100"
									value="unread"
								>
									<div className="flex items-center gap-1.5">
										<Bell className="size-3.5" />
										<span>Unread</span>
									</div>
									{unreadCounts.all > 0 && (
										<Badge
											className="absolute -top-2 right-0 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 shadow-sm"
											variant="default"
										>
											{unreadCounts.all}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger
									className="relative py-1.5 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border data-[state=active]:border-secondary/20 dark:data-[state=active]:border-gray-600 dark:text-gray-300 dark:data-[state=active]:text-gray-100"
									value="channel"
								>
									<div className="flex items-center gap-1.5">
										<Hash className="size-3.5 text-blue-500" />
										<span>Channel</span>
									</div>
									{unreadCounts.channel > 0 && (
										<Badge
											className="absolute -top-2 right-0 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 shadow-sm"
											variant="default"
										>
											{unreadCounts.channel}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger
									className="relative py-1.5 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border data-[state=active]:border-secondary/20 dark:data-[state=active]:border-gray-600 dark:text-gray-300 dark:data-[state=active]:text-gray-100"
									value="direct"
								>
									<div className="flex items-center gap-1.5">
										<User className="size-3.5 text-green-500" />
										<span>Direct</span>
									</div>
									{unreadCounts.direct > 0 && (
										<Badge
											className="absolute -top-2 right-0 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 shadow-sm"
											variant="default"
										>
											{unreadCounts.direct}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger
									className="relative py-1.5 px-3 rounded-md data-[state=active]:bg-white dark:data-[state=active]:bg-gray-700 data-[state=active]:border data-[state=active]:border-secondary/20 dark:data-[state=active]:border-gray-600 dark:text-gray-300 dark:data-[state=active]:text-gray-100"
									value="card"
								>
									<div className="flex items-center gap-1.5">
										<LayoutGrid className="size-3.5 text-amber-500" />
										<span>Cards</span>
									</div>
									{unreadCounts.card > 0 && (
										<Badge
											className="absolute -top-2 right-0 h-5 w-5 p-0 flex items-center justify-center bg-blue-500 shadow-sm"
											variant="default"
										>
											{unreadCounts.card}
										</Badge>
									)}
								</TabsTrigger>
							</TabsList>
						</div>

						<TabsContent className="p-0 focus:outline-none" value={activeTab}>
							{renderNotificationsList(filteredNotifications)}
						</TabsContent>
					</Tabs>
				)}
			</DialogContent>
		</Dialog>
	);
};
