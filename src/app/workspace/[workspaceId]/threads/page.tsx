"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
	Clock,
	FileText,
	Hash,
	Loader,
	MessageCircle,
	MessageSquareText,
	PaintBucket,
	Search,
	User,
} from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetThreadMessages } from "@/features/messages/api/use-get-thread-messages";
import { ThreadModal } from "@/features/messages/components/thread-modal";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

interface ThreadMessage {
	message: {
		_id: Id<"messages">;
		_creationTime: number;
		body: string;
		memberId: Id<"members">;
		image?: Id<"_storage">;
		channelId?: Id<"channels">;
		conversationId?: Id<"conversations">;
		parentMessageId?: Id<"messages">;
		workspaceId: Id<"workspaces">;
		updatedAt?: number;
	};
	parentMessage: {
		_id: Id<"messages">;
		_creationTime: number;
		body: string;
		memberId: Id<"members">;
	};
	parentUser: {
		name: string;
		image?: string;
	};
	currentUser: {
		name: string;
		image?: string;
	};
	context: {
		name: string;
		type: "channel" | "conversation";
		id: Id<"channels"> | Id<"conversations">;
		memberId?: Id<"members">;
	};
}

const ThreadsContent = ({ workspaceId }: { workspaceId: Id<"workspaces"> }) => {
	useSetWorkspaceTitle(
		<WorkspaceTitle icon={MessageSquareText} label="Threads" />
	);

	const threads = useGetThreadMessages() as ThreadMessage[] | undefined;
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState<
		"all" | "channels" | "direct"
	>("all");
	const [selectedThread, setSelectedThread] = useState<ThreadMessage | null>(
		null
	);

	// Get all thread titles for this workspace
	const threadTitles = useQuery(api.messaging.threadTitles.getByWorkspaceId, {
		workspaceId,
	});

	// Get thread reply counts
	const threadReplyCounts = useQuery(
		api.messaging.messages.getThreadReplyCounts,
		threads && threads.length > 0
			? {
					parentMessageIds: threads
						.map((t) => t.message.parentMessageId)
						.filter(Boolean) as Id<"messages">[],
				}
			: "skip"
	);

	// Create a map of messageId -> threadTitle for quick lookup
	const titleMap = useMemo(() => {
		const map = new Map<string, string>();
		if (threadTitles) {
			threadTitles.forEach((tt) => {
				map.set(tt.messageId.toString(), tt.title);
			});
		}
		return map;
	}, [threadTitles]);

	const parseMessageBody = (
		body: string
	): {
		type: "text" | "canvas" | "note";
		content: string;
		isSpecial: boolean;
	} => {
		try {
			const parsed = JSON.parse(body);

			if (parsed.type?.includes("canvas")) {
				return {
					type: "canvas",
					content: parsed.canvasName || "Untitled Canvas",
					isSpecial: true,
				};
			}

			if (parsed.type?.includes("note")) {
				return {
					type: "note",
					content: parsed.noteTitle || "Untitled Note",
					isSpecial: true,
				};
			}

			if (parsed.ops?.[0]?.insert) {
				return {
					type: "text",
					content: parsed.ops[0].insert,
					isSpecial: false,
				};
			}

			return {
				type: "text",
				content: body,
				isSpecial: false,
			};
		} catch {
			return {
				type: "text",
				content: body,
				isSpecial: false,
			};
		}
	};

	const handleOpenThread = (thread: ThreadMessage) => {
		setSelectedThread(thread);
	};

	// Filter threads based on search query and active filter
	const filteredThreads = threads?.filter((thread) => {
		const messageBody = parseMessageBody(thread.message.body);
		const parentBody = parseMessageBody(thread.parentMessage.body);

		const matchesSearch =
			searchQuery === "" ||
			messageBody.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
			parentBody.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
			thread.context.name.toLowerCase().includes(searchQuery.toLowerCase());

		const matchesFilter =
			activeFilter === "all" ||
			(activeFilter === "channels" && thread.context.type === "channel") ||
			(activeFilter === "direct" && thread.context.type === "conversation");

		return matchesSearch && matchesFilter;
	});

	// Group threads by date (today, yesterday, this week, earlier)
	const groupedThreads =
		filteredThreads?.reduce(
			(groups, thread) => {
				const date = new Date(thread.message._creationTime);
				const now = new Date();
				const isToday = date.toDateString() === now.toDateString();
				const isYesterday =
					new Date(now.setDate(now.getDate() - 1)).toDateString() ===
					date.toDateString();
				const isThisWeek = date > new Date(now.setDate(now.getDate() - 6));

				const group = isToday
					? "today"
					: isYesterday
						? "yesterday"
						: isThisWeek
							? "thisWeek"
							: "earlier";

				if (!groups[group]) {
					groups[group] = [];
				}

				groups[group].push(thread);
				return groups;
			},
			{} as Record<string, ThreadMessage[]>
		) || {};

	function renderThreadCard(thread: ThreadMessage) {
		const parsedParentBody = parseMessageBody(thread.parentMessage.body);
		const threadReplyCount =
			threadReplyCounts?.find(
				(tc) => tc.parentMessageId === thread.message.parentMessageId
			)?.count || 0;

		return (
			<Card
				className="group cursor-pointer"
				interactive
				key={thread.message._id}
				onClick={() => handleOpenThread(thread)}
			>
				<CardContent className="p-4">
					<div className="flex items-start justify-between mb-3">
						<div className="flex items-center gap-2 flex-1 min-w-0">
							<Avatar className="size-8 flex-shrink-0">
								<AvatarImage src={thread.parentUser.image} />
								<AvatarFallback>
									{thread.parentUser.name.charAt(0)}
								</AvatarFallback>
							</Avatar>
							<div className="flex-1 min-w-0">
								<div className="flex items-center gap-2">
									<span className="font-semibold text-sm truncate">
										{thread.parentUser.name}
									</span>
									<Badge className="flex-shrink-0" variant="outline">
										{thread.context.type === "channel" ? (
											<span className="flex items-center gap-1">
												<Hash className="size-3" />
												{thread.context.name}
											</span>
										) : (
											<span className="flex items-center gap-1">
												<User className="size-3" />
												{thread.context.name}
											</span>
										)}
									</Badge>
								</div>
								<span className="text-xs text-muted-foreground">
									{formatDistanceToNow(new Date(thread.message._creationTime), {
										addSuffix: true,
									})}
								</span>
							</div>
						</div>
					</div>

					<div className="mb-3">
						{parsedParentBody.isSpecial ? (
							<div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 border border-border">
								{parsedParentBody.type === "canvas" ? (
									<PaintBucket className="size-5 text-primary flex-shrink-0" />
								) : (
									<FileText className="size-5 text-primary flex-shrink-0" />
								)}
								<span className="font-semibold text-sm truncate">
									{parsedParentBody.content}
								</span>
							</div>
						) : (
							<h3 className="font-semibold text-sm line-clamp-2 text-foreground">
								{titleMap.get(thread.message._id.toString()) ||
									parsedParentBody.content}
							</h3>
						)}
					</div>

					<div className="flex items-start gap-2 p-2 rounded-lg bg-muted/30">
						<Avatar className="size-6 flex-shrink-0">
							<AvatarImage src={thread.currentUser.image} />
							<AvatarFallback className="text-xs">
								{thread.currentUser.name.charAt(0)}
							</AvatarFallback>
						</Avatar>
						<div className="flex-1 min-w-0">
							<span className="font-medium text-xs text-muted-foreground">
								{thread.currentUser.name}
							</span>
							<p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
								{parseMessageBody(thread.message.body).content}
							</p>
						</div>
					</div>

					<div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<MessageCircle className="size-3.5" />
							<span>
								{threadReplyCount}{" "}
								{threadReplyCount === 1 ? "reply" : "replies"}
							</span>
						</div>
						<Button
							className="h-7 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
							onClick={(e) => {
								e.stopPropagation();
								handleOpenThread(thread);
							}}
							size="sm"
							variant="ghost"
						>
							Open
						</Button>
					</div>
				</CardContent>
			</Card>
		);
	}

	// We'll use a consistent structure with conditional rendering for the content
	return (
		<>
			{!threads ? (
				// Loading state
				<PageShell>
					<div className="flex flex-col items-center justify-center gap-y-2 py-24">
						<Loader className="size-8 animate-spin text-muted-foreground" />
						<p className="text-sm text-muted-foreground">Loading threads...</p>
					</div>
				</PageShell>
			) : !threads.length ? (
				// Empty state
				<PageShell>
					<EmptyState
						description="Replies you're part of will show up here."
						icon={MessageSquareText}
						title="No threads yet"
					/>
				</PageShell>
			) : (
				// Threads loaded state
				<PageShell className="max-w-4xl">
					<div className="flex items-center gap-4">
						<div className="relative flex-1">
							<Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
							<Input
								className="rounded-full border-border bg-muted/50 pl-10 focus:bg-card"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search threads..."
								type="search"
								value={searchQuery}
							/>
						</div>

						<Tabs
							className="w-[300px]"
							onValueChange={(value) =>
								setActiveFilter(value as "all" | "channels" | "direct")
							}
							value={activeFilter}
						>
							<TabsList className="grid w-full grid-cols-3">
								<TabsTrigger value="all">All</TabsTrigger>
								<TabsTrigger value="channels">Channels</TabsTrigger>
								<TabsTrigger value="direct">Direct</TabsTrigger>
							</TabsList>
						</Tabs>
					</div>

					<div className="mt-6">
						{filteredThreads?.length === 0 ? (
							<EmptyState
								description="Try adjusting your search or filters"
								icon={Search}
								size="sm"
								title="No matching threads"
							/>
						) : (
							<div className="space-y-6">
								{groupedThreads.today?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-4">
											<Clock className="size-4 text-muted-foreground" />
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												Today
											</h3>
										</div>
										<div className="space-y-3">
											{groupedThreads.today.map((thread) =>
												renderThreadCard(thread)
											)}
										</div>
									</div>
								)}

								{groupedThreads.yesterday?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-4">
											<Clock className="size-4 text-muted-foreground" />
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												Yesterday
											</h3>
										</div>
										<div className="space-y-3">
											{groupedThreads.yesterday.map((thread) =>
												renderThreadCard(thread)
											)}
										</div>
									</div>
								)}

								{groupedThreads.thisWeek?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-4">
											<Clock className="size-4 text-muted-foreground" />
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												This Week
											</h3>
										</div>
										<div className="space-y-3">
											{groupedThreads.thisWeek.map((thread) =>
												renderThreadCard(thread)
											)}
										</div>
									</div>
								)}

								{groupedThreads.earlier?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-4">
											<Clock className="size-4 text-muted-foreground" />
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												Earlier
											</h3>
										</div>
										<div className="space-y-3">
											{groupedThreads.earlier.map((thread) =>
												renderThreadCard(thread)
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</PageShell>
			)}

			{selectedThread && (
				<ThreadModal
					isOpen={Boolean(selectedThread)}
					onClose={() => setSelectedThread(null)}
					thread={selectedThread}
				/>
			)}
		</>
	);
};

export default function ThreadsPage() {
	// Set document title
	useDocumentTitle("Threads");

	const workspaceId = useWorkspaceId();

	if (!workspaceId) {
		return null;
	}

	return <ThreadsContent workspaceId={workspaceId as Id<"workspaces">} />;
}
