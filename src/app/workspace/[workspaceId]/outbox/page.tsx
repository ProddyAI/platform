"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
	Brush,
	Clock,
	FileText,
	Filter,
	Hash,
	Mail,
	MessageSquareText,
	Search,
	SortDesc,
	User,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { useGetUserMessages } from "@/features/messages/api/use-get-user-messages";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

type MessageContext = {
	name: string;
	type: "channel" | "conversation" | "unknown";
	id: Id<"channels"> | Id<"conversations">;
	memberId?: Id<"members">;
};

interface Message {
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
	context: MessageContext;
}

const isCanvasType = (type?: string) =>
	type === "canvas" || type === "canvas-live" || type === "canvas-export";

const isNoteType = (type?: string) =>
	type === "note" || type === "note-live" || type === "note-export";

// Render order for the date-grouped sections; matches the Threads page.
const MESSAGE_GROUPS = [
	{ key: "today", label: "Today" },
	{ key: "yesterday", label: "Yesterday" },
	{ key: "thisWeek", label: "This Week" },
	{ key: "earlier", label: "Earlier" },
] as const;

const SkeletonMessageCard = () => (
	<div className="rounded-2xl border bg-card p-4">
		<div className="mb-3 flex items-center justify-between">
			<Skeleton className="h-5 w-32 rounded-full" />
			<Skeleton className="h-4 w-24" />
		</div>
		<Skeleton className="h-4 w-3/4" />
	</div>
);

// Skeleton mirror of the loaded layout (search row + grouped cards) so the
// page doesn't jump when data arrives.
const OutboxSkeleton = () => (
	<div className="space-y-6" role="status">
		<span className="sr-only">Loading sent messages</span>
		<div
			aria-hidden="true"
			className="flex flex-col gap-3 sm:flex-row sm:items-center"
		>
			<Skeleton className="h-10 flex-1 rounded-full" />
			<div className="flex items-center gap-2">
				<Skeleton className="h-10 w-[300px] max-w-full rounded-full" />
				<Skeleton className="size-8 shrink-0 rounded-full" />
				<Skeleton className="size-8 shrink-0 rounded-full" />
			</div>
		</div>
		<div aria-hidden="true" className="space-y-6">
			<div>
				<Skeleton className="mb-4 h-4 w-24" />
				<div className="space-y-3">
					<SkeletonMessageCard />
					<SkeletonMessageCard />
					<SkeletonMessageCard />
				</div>
			</div>
			<div>
				<Skeleton className="mb-4 h-4 w-24" />
				<div className="space-y-3">
					<SkeletonMessageCard />
					<SkeletonMessageCard />
				</div>
			</div>
		</div>
	</div>
);

export default function OutboxPage() {
	useDocumentTitle("Sent");

	useSetWorkspaceTitle(<WorkspaceTitle icon={Mail} label="Sent" />);

	const workspaceId = useWorkspaceId();
	const messages = useGetUserMessages() as Message[] | undefined;
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState<
		"all" | "channels" | "direct"
	>("all");

	// Filter states
	const [showTextMessages, setShowTextMessages] = useState(true);
	const [showCanvasMessages, setShowCanvasMessages] = useState(true);
	const [showNoteMessages, setShowNoteMessages] = useState(true);

	// Sort state
	const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

	const parseMessageBody = useCallback((body: string) => {
		try {
			const parsed = JSON.parse(body);
			if (isCanvasType(parsed.type) || isNoteType(parsed.type)) {
				return parsed;
			}
			if (parsed.ops?.[0]?.insert) {
				return parsed.ops[0].insert.trim();
			}
		} catch {
			return body;
		}
		return body;
	}, []);

	const getMessageUrl = (message: Message) => {
		const parsedBody = parseMessageBody(message.body);
		if (typeof parsedBody === "object" && isCanvasType(parsedBody.type)) {
			return `/workspace/${workspaceId}/channel/${message.context.id}/canvas?roomId=${parsedBody.roomId}`;
		}
		if (typeof parsedBody === "object" && isNoteType(parsedBody.type)) {
			return `/workspace/${workspaceId}/channel/${message.context.id}/notes?noteId=${parsedBody.noteId}`;
		}
		if (message.context.type === "channel") {
			return `/workspace/${workspaceId}/channel/${message.context.id}/chats`;
		}
		if (message.context.type === "conversation" && message.context.memberId) {
			return `/workspace/${workspaceId}/member/${message.context.memberId}`;
		}
		return "#";
	};

	// Filter and sort messages
	const filteredAndSortedMessages = useMemo(() => {
		if (!messages) return undefined;

		// Filter messages based on search query and active filter
		const filtered = messages.filter((message) => {
			const parsedBody = parseMessageBody(message.body);
			const bodyText =
				typeof parsedBody === "object" && parsedBody !== null
					? parsedBody.canvasName || parsedBody.noteTitle || ""
					: parsedBody || "";

			const matchesSearch =
				searchQuery === "" ||
				(typeof bodyText === "string" &&
					bodyText.toLowerCase().includes(searchQuery.toLowerCase())) ||
				message.context.name.toLowerCase().includes(searchQuery.toLowerCase());

			const matchesFilter =
				activeFilter === "all" ||
				(activeFilter === "channels" && message.context.type === "channel") ||
				(activeFilter === "direct" && message.context.type === "conversation");

			// Message type filter
			const messageType =
				typeof parsedBody === "object" ? parsedBody.type : "text";
			const matchesTypeFilter = isCanvasType(messageType)
				? showCanvasMessages
				: isNoteType(messageType)
					? showNoteMessages
					: showTextMessages;

			return matchesSearch && matchesFilter && matchesTypeFilter;
		});

		// Sort messages
		return [...filtered].sort((a, b) => {
			if (sortBy === "newest") {
				return b._creationTime - a._creationTime;
			}
			if (sortBy === "oldest") {
				return a._creationTime - b._creationTime;
			}
			return a.context.name.localeCompare(b.context.name);
		});
	}, [
		messages,
		searchQuery,
		activeFilter,
		showTextMessages,
		showCanvasMessages,
		showNoteMessages,
		sortBy,
		parseMessageBody,
	]);

	// Group messages by date (today, yesterday, this week, earlier)
	const groupedMessages =
		filteredAndSortedMessages?.reduce(
			(groups, message) => {
				const date = new Date(message._creationTime);
				const now = new Date();
				const yesterday = new Date(now);
				yesterday.setDate(yesterday.getDate() - 1);
				const weekAgo = new Date(now);
				weekAgo.setDate(weekAgo.getDate() - 6);

				const group =
					date.toDateString() === now.toDateString()
						? "today"
						: date.toDateString() === yesterday.toDateString()
							? "yesterday"
							: date > weekAgo
								? "thisWeek"
								: "earlier";

				if (!groups[group]) {
					groups[group] = [];
				}

				groups[group].push(message);
				return groups;
			},
			{} as Record<string, Message[]>
		) || {};

	function renderMessageCard(message: Message) {
		const content = parseMessageBody(message.body);
		const sentAt = new Date(message._creationTime);

		return (
			<Link
				className="flex flex-col rounded-2xl border bg-card p-4 shadow-sm transition-[transform,box-shadow] duration-fast hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background motion-reduce:transition-none motion-reduce:hover:translate-y-0"
				href={getMessageUrl(message)}
				key={message._id}
			>
				<div className="mb-3 flex items-center justify-between gap-2">
					<Badge className="min-w-0" variant="outline">
						{message.context.type === "channel" ? (
							<Hash aria-hidden="true" className="size-3 shrink-0" />
						) : (
							<User aria-hidden="true" className="size-3 shrink-0" />
						)}
						<span className="truncate">{message.context.name}</span>
					</Badge>
					<time
						className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground"
						dateTime={sentAt.toISOString()}
						title={format(sentAt, "MMM d, yyyy, h:mm a")}
					>
						<Clock aria-hidden="true" className="size-3" />
						{formatDistanceToNow(sentAt, { addSuffix: true })}
					</time>
				</div>

				{typeof content === "object" ? (
					<div className="flex items-center gap-2 text-sm text-card-foreground">
						{isCanvasType(content.type) ? (
							<>
								<Brush
									aria-hidden="true"
									className="size-4 shrink-0 text-muted-foreground"
								/>
								<span className="truncate">
									Canvas:{" "}
									{content.canvasName ||
										content.roomId?.split("-").slice(1, -1).join("-") ||
										"Untitled Canvas"}
								</span>
							</>
						) : (
							<>
								<FileText
									aria-hidden="true"
									className="size-4 shrink-0 text-muted-foreground"
								/>
								<span className="truncate">
									Note: {content.noteTitle || "Untitled Note"}
								</span>
							</>
						)}
					</div>
				) : (
					<p className="line-clamp-2 text-sm text-card-foreground">{content}</p>
				)}
			</Link>
		);
	}

	// Always render the same outer structure to maintain toolbar visibility
	return (
		<PageShell>
			{!messages ? (
				<OutboxSkeleton />
			) : !messages.length ? (
				<EmptyState
					description="Messages you send in channels and direct messages will show up here."
					icon={Mail}
					title="No messages sent yet"
				/>
			) : (
				<div className="space-y-6">
					<div className="flex flex-col gap-3 sm:flex-row sm:items-center">
						<div className="relative flex-1">
							<Search
								aria-hidden="true"
								className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
							/>
							<Input
								aria-label="Search sent messages"
								className="rounded-full border-border bg-muted/50 pl-10 focus:bg-card"
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search messages..."
								type="search"
								value={searchQuery}
							/>
						</div>

						<div className="flex items-center gap-2">
							<Tabs
								className="min-w-0 flex-1 sm:w-[300px] sm:flex-none"
								onValueChange={(value) =>
									setActiveFilter(value as typeof activeFilter)
								}
								value={activeFilter}
							>
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger value="all">All</TabsTrigger>
									<TabsTrigger value="channels">Channels</TabsTrigger>
									<TabsTrigger value="direct">Direct</TabsTrigger>
								</TabsList>
							</Tabs>

							<DropdownMenu>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<Button
													aria-label="Filter messages"
													size="iconSm"
													variant="outline"
												>
													<Filter className="size-4" />
												</Button>
											</DropdownMenuTrigger>
										</TooltipTrigger>
										<TooltipContent>
											<p>Filter messages</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<DropdownMenuContent align="end" className="w-56">
									<DropdownMenuLabel>Filter by type</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuCheckboxItem
										checked={showTextMessages}
										onCheckedChange={setShowTextMessages}
									>
										<MessageSquareText className="mr-2 size-4" />
										Text messages
									</DropdownMenuCheckboxItem>
									<DropdownMenuCheckboxItem
										checked={showCanvasMessages}
										onCheckedChange={setShowCanvasMessages}
									>
										<Brush className="mr-2 size-4" />
										Canvas messages
									</DropdownMenuCheckboxItem>
									<DropdownMenuCheckboxItem
										checked={showNoteMessages}
										onCheckedChange={setShowNoteMessages}
									>
										<FileText className="mr-2 size-4" />
										Note messages
									</DropdownMenuCheckboxItem>
								</DropdownMenuContent>
							</DropdownMenu>

							<DropdownMenu>
								<TooltipProvider>
									<Tooltip>
										<TooltipTrigger asChild>
											<DropdownMenuTrigger asChild>
												<Button
													aria-label="Sort messages"
													size="iconSm"
													variant="outline"
												>
													<SortDesc className="size-4" />
												</Button>
											</DropdownMenuTrigger>
										</TooltipTrigger>
										<TooltipContent>
											<p>Sort messages</p>
										</TooltipContent>
									</Tooltip>
								</TooltipProvider>
								<DropdownMenuContent align="end" className="w-48">
									<DropdownMenuLabel>Sort by</DropdownMenuLabel>
									<DropdownMenuSeparator />
									<DropdownMenuRadioGroup
										onValueChange={(value) => setSortBy(value as typeof sortBy)}
										value={sortBy}
									>
										<DropdownMenuRadioItem value="newest">
											Newest first
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="oldest">
											Oldest first
										</DropdownMenuRadioItem>
										<DropdownMenuRadioItem value="name">
											By name (A-Z)
										</DropdownMenuRadioItem>
									</DropdownMenuRadioGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					{filteredAndSortedMessages?.length === 0 ? (
						<EmptyState
							description="Try adjusting your search or filters"
							icon={Search}
							size="sm"
							title="No matching messages"
						/>
					) : (
						<div className="space-y-6">
							{MESSAGE_GROUPS.map(({ key, label }) => {
								const group = groupedMessages[key];
								if (!group?.length) return null;

								return (
									<section key={key}>
										<div className="mb-4 flex items-center gap-2">
											<Clock
												aria-hidden="true"
												className="size-4 text-muted-foreground"
											/>
											<h3 className="text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
												{label}
											</h3>
										</div>
										<div className="space-y-3">
											{group.map((message) => renderMessageCard(message))}
										</div>
									</section>
								);
							})}
						</div>
					)}
				</div>
			)}
		</PageShell>
	);
}
