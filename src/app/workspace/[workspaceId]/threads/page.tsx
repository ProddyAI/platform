"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
	Clock,
	FileText,
	Hash,
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
import { Skeleton } from "@/components/ui/skeleton";
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

type ParsedMessageBody = {
	type: "text" | "canvas" | "note";
	content: string;
	isSpecial: boolean;
};

const parseMessageBody = (body: string): ParsedMessageBody => {
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

		return { type: "text", content: body, isSpecial: false };
	} catch {
		return { type: "text", content: body, isSpecial: false };
	}
};

const DAY_MS = 24 * 60 * 60 * 1000;

type ThreadGroupKey = "today" | "yesterday" | "thisWeek" | "earlier";

// Render order + sentence-case labels for the date sections.
const THREAD_GROUPS: { key: ThreadGroupKey; label: string }[] = [
	{ key: "today", label: "Today" },
	{ key: "yesterday", label: "Yesterday" },
	{ key: "thisWeek", label: "This week" },
	{ key: "earlier", label: "Earlier" },
];

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
	const now = new Date();
	const todayStart = new Date(
		now.getFullYear(),
		now.getMonth(),
		now.getDate()
	).getTime();
	const yesterdayStart = todayStart - DAY_MS;
	const weekStart = todayStart - 6 * DAY_MS;

	const groupedThreads =
		filteredThreads?.reduce(
			(groups, thread) => {
				const time = thread.message._creationTime;

				const group: ThreadGroupKey =
					time >= todayStart
						? "today"
						: time >= yesterdayStart
							? "yesterday"
							: time >= weekStart
								? "thisWeek"
								: "earlier";

				const bucket = groups[group] ?? [];
				bucket.push(thread);
				groups[group] = bucket;
				return groups;
			},
			{} as Partial<Record<ThreadGroupKey, ThreadMessage[]>>
		) || {};

	function renderThreadCard(thread: ThreadMessage) {
		const parsedParentBody = parseMessageBody(thread.parentMessage.body);
		const parsedLatestReply = parseMessageBody(thread.message.body);
		const threadTitle =
			titleMap.get(thread.message._id.toString()) || parsedParentBody.content;
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
					<div className="mb-3 flex items-center gap-2">
						<Avatar className="size-8 flex-shrink-0">
							<AvatarImage src={thread.parentUser.image} />
							<AvatarFallback>
								{thread.parentUser.name.charAt(0)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<div className="flex items-center gap-2">
								<span className="truncate text-sm font-semibold">
									{thread.parentUser.name}
								</span>
								<Badge className="flex-shrink-0" variant="outline">
									<span className="flex items-center gap-1">
										{thread.context.type === "channel" ? (
											<Hash aria-hidden className="size-3" />
										) : (
											<User aria-hidden className="size-3" />
										)}
										{thread.context.name}
									</span>
								</Badge>
							</div>
							<span className="text-xs text-muted-foreground">
								{formatDistanceToNow(new Date(thread.message._creationTime), {
									addSuffix: true,
								})}
							</span>
						</div>
					</div>

					<div className="mb-3">
						{parsedParentBody.isSpecial ? (
							<div className="flex items-center gap-2 rounded-lg border border-border bg-muted/50 p-3">
								{parsedParentBody.type === "canvas" ? (
									<PaintBucket
										aria-hidden
										className="size-5 flex-shrink-0 text-primary"
									/>
								) : (
									<FileText
										aria-hidden
										className="size-5 flex-shrink-0 text-primary"
									/>
								)}
								<span className="truncate text-sm font-semibold">
									{parsedParentBody.content}
								</span>
							</div>
						) : (
							<h4 className="line-clamp-2 text-sm font-semibold text-foreground">
								{threadTitle}
							</h4>
						)}
					</div>

					<div className="flex items-start gap-2 rounded-lg bg-muted/30 p-2">
						<Avatar className="size-6 flex-shrink-0">
							<AvatarImage src={thread.currentUser.image} />
							<AvatarFallback className="text-xs">
								{thread.currentUser.name.charAt(0)}
							</AvatarFallback>
						</Avatar>
						<div className="min-w-0 flex-1">
							<span className="text-xs font-medium text-muted-foreground">
								{thread.currentUser.name}
							</span>
							<p className="mt-0.5 line-clamp-1 text-xs text-muted-foreground">
								{parsedLatestReply.content}
							</p>
						</div>
					</div>

					<div className="mt-3 flex items-center justify-between border-t border-border pt-3">
						<div className="flex items-center gap-1 text-xs text-muted-foreground">
							<MessageCircle aria-hidden className="size-3.5" />
							<span>
								{threadReplyCount}{" "}
								{threadReplyCount === 1 ? "reply" : "replies"}
							</span>
						</div>
						<Button
							aria-label={`Open thread: ${threadTitle}`}
							className="h-7 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
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

	return (
		<>
			{!threads ? (
				// Loading state — skeletons mirror the loaded layout so nothing jumps
				<PageShell className="max-w-4xl">
					<div
						aria-busy="true"
						aria-label="Loading threads"
						className="space-y-6"
						role="status"
					>
						<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
							<Skeleton className="h-10 flex-1 rounded-full" />
							<Skeleton className="h-10 w-full rounded-full sm:w-[300px]" />
						</div>
						<div className="space-y-3">
							<Skeleton className="h-4 w-20" />
							<Skeleton className="h-40 rounded-2xl" />
							<Skeleton className="h-40 rounded-2xl" />
							<Skeleton className="h-40 rounded-2xl" />
						</div>
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
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-4">
						<div className="relative flex-1">
							<Search
								aria-hidden
								className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label="Search threads"
								className="rounded-full border-border bg-muted/50 pl-10 focus:bg-card"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search threads..."
								type="search"
								value={searchQuery}
							/>
						</div>

						<Tabs
							className="w-full sm:w-[300px]"
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

					{filteredThreads?.length === 0 ? (
						<EmptyState
							description="Try a different search or filter."
							icon={Search}
							size="sm"
							title="No matching threads"
						/>
					) : (
						<div className="space-y-6">
							{THREAD_GROUPS.map(({ key, label }) => {
								const group = groupedThreads[key];
								if (!group?.length) return null;

								return (
									<section aria-label={label} key={key}>
										<div className="mb-4 flex items-center gap-2">
											<Clock
												aria-hidden
												className="size-4 text-muted-foreground"
											/>
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												{label}
											</h3>
										</div>
										<div className="space-y-3">
											{group.map((thread) => renderThreadCard(thread))}
										</div>
									</section>
								);
							})}
						</div>
					)}
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
