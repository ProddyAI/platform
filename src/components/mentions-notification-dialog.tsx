"use client";

import { useQuery } from "convex/react";
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
import { useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useAdBlockerDetectionContext } from "@/components/providers/ad-blocker-provider";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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

interface MentionsNotificationDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
}

type NotificationItem =
	| ((typeof api.messaging.mentions.getProcessedMentions._returnType)[number] & {
			type: "mention";
	  })
	| ((typeof api.messaging.direct.getDirectMessagesForCurrentUser._returnType)[number] & {
			type: "direct";
	  });

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
	const projects = useQuery(
		api.planning.projects.get,
		workspaceId ? { workspaceId } : "skip"
	);

	const projectIdByBoardChannelId = useMemo(() => {
		const mapping = new Map<Id<"channels">, Id<"projects">>();

		for (const project of projects || []) {
			mapping.set(project.boardChannelId, project._id);
		}

		return mapping;
	}, [projects]);

	// Combine mentions and direct messages
	const allNotifications = [
		...(mentions || []).map((mention) => ({
			...mention,
			type: "mention" as const,
		})),
		...(directMessages || []).map((message) => ({
			...message,
			type: "direct" as const,
		})),
	];

	// Sort by timestamp (newest first)
	allNotifications.sort((a, b) => b.timestamp - a.timestamp);

	const isLoading = isLoadingMentions || isLoadingDirectMessages;

	const handleToggleReadStatus = async (notification: NotificationItem) => {
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
				return <User className="size-4 text-success" />;
			case "thread":
				return <MessageSquare className="size-4 text-purple-500" />;
			case "card":
				return <LayoutGrid className="size-4 text-warning" />;
			default:
				return <AtSign className="size-4 text-muted-foreground" />;
		}
	};

	const getSourceLink = (mention: NotificationItem) => {
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
			case "card": {
				// Prefer project board route when the board channel has a project mapping.
				const projectId = projectIdByBoardChannelId.get(
					mention.source.id as Id<"channels">
				);
				if (projectId) {
					return `/workspace/${workspaceId}/project/${projectId}/board`;
				}

				return `/workspace/${workspaceId}/issues`;
			}
			default:
				return `/workspace/${workspaceId}`;
		}
	};

	// Filter notifications based on active tab
	const filteredNotifications = allNotifications.filter((notification) => {
		// Check if the notification has the required properties
		if (!notification) return false;

		if (activeTab === "all") return true;
		if (activeTab === "unread") return !notification.read;

		if (activeTab === "direct") {
			// For the direct tab, show both direct messages and mentions in direct chats
			if (notification.type === "direct") return true;
			return (
				notification.type === "mention" &&
				notification.source?.type === "direct"
			);
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
		all: allNotifications.filter((n) => !n.read).length || 0,
		channel:
			allNotifications.filter(
				(n) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "channel"
			).length || 0,
		direct:
			allNotifications.filter(
				(n) =>
					(n.type === "direct" && !n.read) ||
					(n.type === "mention" &&
						!n.read &&
						n.source &&
						n.source.type === "direct")
			).length || 0,
		thread:
			allNotifications.filter(
				(n) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "thread"
			).length || 0,
		card:
			allNotifications.filter(
				(n) =>
					n.type === "mention" &&
					!n.read &&
					n.source &&
					n.source.type === "card"
			).length || 0,
	};

	const renderNotificationsList = (notificationsList: NotificationItem[]) => (
		<div className="divide-y divide-border/20 dark:divide-border/10 max-h-[450px] overflow-y-auto">
			{notificationsList?.length === 0 ? (
				<div className="flex h-[250px] w-full flex-col items-center justify-center gap-y-3 bg-muted/40">
					{activeTab === "unread" ? (
						<>
							<div className="rounded-full bg-success/10 p-3">
								<CheckCircle2 className="size-10 text-success" />
							</div>
							<h2 className="text-xl font-semibold">All caught up</h2>
							<p className="text-sm text-muted-foreground">
								You have no unread notifications
							</p>
						</>
					) : activeTab === "all" ? (
						<>
							<div className="rounded-full bg-primary/10 p-3">
								<Bell className="size-10 text-primary" />
							</div>
							<h2 className="text-xl font-semibold">No notifications yet</h2>
							<p className="text-sm text-muted-foreground">
								When you receive notifications, they will appear here
							</p>
						</>
					) : activeTab === "direct" ? (
						<>
							<div className="rounded-full bg-success/10 p-3">
								<MessageSquare className="size-10 text-success" />
							</div>
							<h2 className="text-xl font-semibold">No direct messages</h2>
							<p className="text-sm text-muted-foreground">
								When someone sends you a direct message, it will appear here
							</p>
						</>
					) : (
						<>
							<div className="rounded-full bg-muted p-3">
								<Filter className="size-10 text-muted-foreground" />
							</div>
							<h2 className="text-xl font-semibold">
								No {activeTab} notifications
							</h2>
							<p className="text-sm text-muted-foreground">
								Try checking other categories
							</p>
						</>
					)}
				</div>
			) : (
				notificationsList?.map((notification) => {
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
							className={`group relative block p-4 transition-colors hover:bg-accent/60 ${!notification.read ? "bg-primary/5" : ""}`}
							href={link}
							key={notification.id}
							onClick={() => onOpenChange(false)}
						>
							<div className="flex items-start gap-3">
								<Avatar className="size-10 border">
									<AvatarImage src={notification.author.image} />
									<AvatarFallback className="bg-primary/10 text-primary font-medium">
										{notification.author.name.charAt(0)}
									</AvatarFallback>
								</Avatar>

								<div className="flex-1 space-y-2">
									<div className="flex flex-wrap items-center gap-2">
										<span className="font-semibold">
											{notification.author.name}
										</span>
										<div className="flex items-center gap-1 text-xs text-muted-foreground">
											<Clock className="size-3.5" />
											<span>{formatRelativeTime(notification.timestamp)}</span>
										</div>

										{/* Source badge - different for direct messages */}
										<div className="ml-auto flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
											{isDirect ? (
												<MessageSquare className="size-4 text-success" />
											) : (
												getSourceIcon(notification.source.type)
											)}
											<span>
												{isDirect ? "Direct Message" : notification.source.name}
											</span>
										</div>
									</div>

									<p className="text-sm leading-relaxed mb-3">
										{notification.text}
									</p>

									{/* Read/Unread toggle button at the bottom */}
									<div className="flex justify-end mt-1">
										<button
											className={`flex items-center gap-1.5 text-xs font-medium rounded-full px-2.5 py-1.5 transition-colors ${
												notification.read
													? "text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20"
													: "text-success hover:text-success/80 bg-success/10 hover:bg-success/20"
											}`}
											onClick={(e) => {
												e.preventDefault(); // Prevent navigation
												e.stopPropagation(); // Prevent event bubbling
												handleToggleReadStatus(notification);
											}}
											type="button"
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
			<DialogContent className="sm:max-w-[550px] p-0 overflow-hidden">
				<DialogHeader className="space-y-3 border-b p-5 pr-10">
					<div className="flex items-center justify-between">
						<DialogTitle className="flex items-center gap-2 text-xl">
							<div className="rounded-full bg-primary/10 p-1.5">
								<Bell className="size-5 text-primary" />
							</div>
							<span>Notifications</span>
							{unreadCounts.all > 0 && (
								<Badge className="ml-2" variant="default">
									{unreadCounts.all} new
								</Badge>
							)}
						</DialogTitle>
						{unreadCounts.all > 0 && (
							<Button
								className="gap-1.5 text-xs text-primary hover:bg-primary/10 hover:text-primary"
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
						<Alert className="border-destructive/20 bg-destructive/10">
							<AlertTriangle className="size-4 text-destructive" />
							<AlertDescription className="text-destructive text-sm">
								Notifications may be blocked by your browser or network settings
							</AlertDescription>
						</Alert>
					)}
				</DialogHeader>

				{isLoading ? (
					<div className="flex h-[300px] w-full items-center justify-center bg-muted/40">
						<div className="flex flex-col items-center gap-3">
							<Loader className="size-8 animate-spin text-primary" />
							<p className="text-sm text-muted-foreground">
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
						<div className="border-b bg-muted/30 px-4 py-3">
							<TabsList className="grid w-full grid-cols-5 rounded-lg p-1">
								<TabsTrigger className="relative px-3 py-1.5" value="all">
									<div className="flex items-center gap-1.5">
										<Filter className="size-3.5" />
										<span>All</span>
									</div>
									{unreadCounts.all > 0 && (
										<Badge
											className="absolute -top-2 right-0 flex size-5 items-center justify-center p-0 shadow-sm"
											variant="default"
										>
											{unreadCounts.all}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger className="relative px-3 py-1.5" value="unread">
									<div className="flex items-center gap-1.5">
										<Bell className="size-3.5" />
										<span>Unread</span>
									</div>
								</TabsTrigger>

								<TabsTrigger className="relative px-3 py-1.5" value="channel">
									<div className="flex items-center gap-1.5">
										<Hash className="size-3.5 text-blue-500" />
										<span>Channel</span>
									</div>
									{unreadCounts.channel > 0 && (
										<Badge
											className="absolute -top-2 right-0 flex size-5 items-center justify-center p-0 shadow-sm"
											variant="default"
										>
											{unreadCounts.channel}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger className="relative px-3 py-1.5" value="direct">
									<div className="flex items-center gap-1.5">
										<User className="size-3.5 text-success" />
										<span>Direct</span>
									</div>
									{unreadCounts.direct > 0 && (
										<Badge
											className="absolute -top-2 right-0 flex size-5 items-center justify-center p-0 shadow-sm"
											variant="default"
										>
											{unreadCounts.direct}
										</Badge>
									)}
								</TabsTrigger>

								<TabsTrigger className="relative px-3 py-1.5" value="card">
									<div className="flex items-center gap-1.5">
										<LayoutGrid className="size-3.5 text-warning" />
										<span>Cards</span>
									</div>
									{unreadCounts.card > 0 && (
										<Badge
											className="absolute -top-2 right-0 flex size-5 items-center justify-center p-0 shadow-sm"
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
