"use client";

import { format, formatDistanceToNow } from "date-fns";
import {
	Brush,
	Clock,
	FileText,
	Filter,
	Hash,
	Loader,
	Mail,
	Search,
	SortDesc,
	User,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
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
import { WorkspaceToolbar } from "../toolbar";

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

export default function OutboxPage() {
	// Set document title
	useDocumentTitle("Outbox");

	const workspaceId = useWorkspaceId();
	const messages = useGetUserMessages() as Message[] | undefined;
	const [searchQuery, setSearchQuery] = useState("");
	const [activeFilter, setActiveFilter] = useState("all");

	// Filter states
	const [showTextMessages, setShowTextMessages] = useState(true);
	const [showCanvasMessages, setShowCanvasMessages] = useState(true);
	const [showNoteMessages, setShowNoteMessages] = useState(true);

	// Sort state
	const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name">("newest");

	const parseMessageBody = (body: string) => {
		try {
			const parsed = JSON.parse(body);
			if (
				parsed.type === "canvas" ||
				parsed.type === "canvas-live" ||
				parsed.type === "canvas-export" ||
				parsed.type === "note" ||
				parsed.type === "note-live" ||
				parsed.type === "note-export"
			) {
				return parsed;
			}
			if (parsed.ops?.[0]?.insert) {
				return parsed.ops[0].insert.trim();
			}
		} catch (_e) {
			return body;
		}
		return body;
	};

	const getMessageUrl = (message: Message) => {
		const parsedBody = parseMessageBody(message.body);
		if (
			typeof parsedBody === "object" &&
			(parsedBody.type === "canvas" ||
				parsedBody.type === "canvas-live" ||
				parsedBody.type === "canvas-export")
		) {
			return `/workspace/${workspaceId}/channel/${message.context.id}/canvas?roomId=${parsedBody.roomId}`;
		}
		if (
			typeof parsedBody === "object" &&
			(parsedBody.type === "note" ||
				parsedBody.type === "note-live" ||
				parsedBody.type === "note-export")
		) {
			return `/workspace/${workspaceId}/channel/${message.context.id}/notes?noteId=${parsedBody.noteId}`;
		}
		if (message.context.type === "channel") {
			return `/workspace/${workspaceId}/channel/${message.context.id}/chats`;
		} else if (
			message.context.type === "conversation" &&
			message.context.memberId
		) {
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
			const matchesTypeFilter =
				((messageType === "canvas" ||
					messageType === "canvas-live" ||
					messageType === "canvas-export") &&
					showCanvasMessages) ||
				((messageType === "note" ||
					messageType === "note-live" ||
					messageType === "note-export") &&
					showNoteMessages) ||
				(messageType !== "canvas" &&
					messageType !== "canvas-live" &&
					messageType !== "canvas-export" &&
					messageType !== "note" &&
					messageType !== "note-live" &&
					messageType !== "note-export" &&
					showTextMessages);

			return matchesSearch && matchesFilter && matchesTypeFilter;
		});

		// Sort messages
		const sorted = [...filtered].sort((a, b) => {
			if (sortBy === "newest") {
				return b._creationTime - a._creationTime;
			} else if (sortBy === "oldest") {
				return a._creationTime - b._creationTime;
			} else if (sortBy === "name") {
				return a.context.name.localeCompare(b.context.name);
			}
			return 0;
		});

		return sorted;
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

				groups[group].push(message);
				return groups;
			},
			{} as Record<string, Message[]>
		) || {};

	// Always render the same outer structure to maintain toolbar visibility
	return (
		<>
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
				>
					<Mail className="mr-2 size-5" />
					<span className="truncate">Outbox</span>
				</Button>
			</WorkspaceToolbar>

			{/* Content area - changes based on state */}
			{!messages ? (
				// Loading state
				<div className="flex flex-1 w-full flex-col items-center justify-center gap-y-2 bg-white">
					<Loader className="size-12 animate-spin text-muted-foreground" />
					<p className="text-sm text-muted-foreground">Loading messages...</p>
				</div>
			) : !messages.length ? (
				// Empty state
				<div className="flex flex-1 w-full flex-col items-center justify-center gap-y-2 bg-white">
					<Mail className="size-12 text-muted-foreground" />
					<h2 className="text-2xl font-semibold">Outbox</h2>
					<p className="text-sm text-muted-foreground">No messages sent yet.</p>
				</div>
			) : (
				// Messages loaded state
				<div className="flex flex-1 flex-col bg-white overflow-hidden">
					<div className="border-b p-4 flex-shrink-0">
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-xl font-semibold">Your Messages</h2>
							<div className="flex items-center gap-2">
								<DropdownMenu>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<DropdownMenuTrigger asChild>
													<Button
														className="h-8 w-8"
														size="icon"
														variant="outline"
													>
														<Filter className="h-4 w-4" />
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
											<FileText className="mr-2 h-4 w-4" />
											Text Messages
										</DropdownMenuCheckboxItem>
										<DropdownMenuCheckboxItem
											checked={showCanvasMessages}
											onCheckedChange={setShowCanvasMessages}
										>
											<Brush className="mr-2 h-4 w-4" />
											Canvas Messages
										</DropdownMenuCheckboxItem>
										<DropdownMenuCheckboxItem
											checked={showNoteMessages}
											onCheckedChange={setShowNoteMessages}
										>
											<FileText className="mr-2 h-4 w-4" />
											Note Messages
										</DropdownMenuCheckboxItem>
									</DropdownMenuContent>
								</DropdownMenu>

								<DropdownMenu>
									<TooltipProvider>
										<Tooltip>
											<TooltipTrigger asChild>
												<DropdownMenuTrigger asChild>
													<Button
														className="h-8 w-8"
														size="icon"
														variant="outline"
													>
														<SortDesc className="h-4 w-4" />
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
											onValueChange={(value) =>
												setSortBy(value as typeof sortBy)
											}
											value={sortBy}
										>
											<DropdownMenuRadioItem value="newest">
												Newest First
											</DropdownMenuRadioItem>
											<DropdownMenuRadioItem value="oldest">
												Oldest First
											</DropdownMenuRadioItem>
											<DropdownMenuRadioItem value="name">
												By Name (A-Z)
											</DropdownMenuRadioItem>
										</DropdownMenuRadioGroup>
									</DropdownMenuContent>
								</DropdownMenu>
							</div>
						</div>

						<div className="flex items-center gap-4">
							<div className="relative flex-1">
								<Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
								<Input
									className="pl-8"
									onChange={(e) => setSearchQuery(e.target.value)}
									placeholder="Search messages..."
									type="search"
									value={searchQuery}
								/>
							</div>

							<Tabs className="w-[300px]" defaultValue="all">
								<TabsList className="grid w-full grid-cols-3">
									<TabsTrigger
										onClick={() => setActiveFilter("all")}
										value="all"
									>
										All
									</TabsTrigger>
									<TabsTrigger
										onClick={() => setActiveFilter("channels")}
										value="channels"
									>
										Channels
									</TabsTrigger>
									<TabsTrigger
										onClick={() => setActiveFilter("direct")}
										value="direct"
									>
										Direct
									</TabsTrigger>
								</TabsList>
							</Tabs>
						</div>
					</div>

					<div className="flex-1 overflow-y-auto p-4">
						{filteredAndSortedMessages?.length === 0 ? (
							<div className="flex h-full flex-col items-center justify-center gap-y-2">
								<Search className="size-12 text-muted-foreground" />
								<h3 className="text-lg font-medium">No matching messages</h3>
								<p className="text-sm text-muted-foreground">
									Try adjusting your search or filters
								</p>
							</div>
						) : (
							<div className="space-y-6">
								{/* Today's messages */}
								{groupedMessages.today?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<Badge
												className="rounded-full px-3 py-1 bg-secondary/5"
												variant="outline"
											>
												<Clock className="mr-1 h-3 w-3" />
												Today
											</Badge>
										</div>
										<div className="space-y-3">
											{groupedMessages.today.map((message) =>
												renderMessageCard(message)
											)}
										</div>
									</div>
								)}

								{/* Yesterday's messages */}
								{groupedMessages.yesterday?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<Badge
												className="rounded-full px-3 py-1 bg-muted"
												variant="outline"
											>
												<Clock className="mr-1 h-3 w-3" />
												Yesterday
											</Badge>
										</div>
										<div className="space-y-3">
											{groupedMessages.yesterday.map((message) =>
												renderMessageCard(message)
											)}
										</div>
									</div>
								)}

								{/* This week's messages */}
								{groupedMessages.thisWeek?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<Badge
												className="rounded-full px-3 py-1 bg-muted"
												variant="outline"
											>
												<Clock className="mr-1 h-3 w-3" />
												This Week
											</Badge>
										</div>
										<div className="space-y-3">
											{groupedMessages.thisWeek.map((message) =>
												renderMessageCard(message)
											)}
										</div>
									</div>
								)}

								{/* Earlier messages */}
								{groupedMessages.earlier?.length > 0 && (
									<div>
										<div className="flex items-center gap-2 mb-3">
											<Badge
												className="rounded-full px-3 py-1 bg-muted"
												variant="outline"
											>
												<Clock className="mr-1 h-3 w-3" />
												Earlier
											</Badge>
										</div>
										<div className="space-y-3">
											{groupedMessages.earlier.map((message) =>
												renderMessageCard(message)
											)}
										</div>
									</div>
								)}
							</div>
						)}
					</div>
				</div>
			)}
		</>
	);

	function renderMessageCard(message: Message) {
		const content = parseMessageBody(message.body);

		return (
			<Link
				className="flex flex-col rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-all"
				href={getMessageUrl(message)}
				key={message._id}
			>
				<div className="flex items-center justify-between mb-3">
					<div className="flex items-center gap-2">
						<Badge
							className={`rounded-full px-2 py-0.5 ${message.context.type === "channel" ? "bg-blue-50 text-blue-700" : "bg-purple-50 text-purple-700"}`}
							variant="outline"
						>
							{message.context.type === "channel" ? (
								<span className="flex items-center">
									<Hash className="mr-1 h-3 w-3" />
									{message.context.name}
								</span>
							) : (
								<span className="flex items-center">
									<User className="mr-1 h-3 w-3" />
									{message.context.name}
								</span>
							)}
						</Badge>
					</div>
					<div className="flex items-center gap-1 text-xs text-muted-foreground">
						<Clock className="h-3 w-3" />
						<span>
							{formatDistanceToNow(new Date(message._creationTime), {
								addSuffix: true,
							})}
						</span>
					</div>
				</div>

				<div className="flex items-start gap-3">
					<div className="flex-1 space-y-1">
						{typeof content === "object" ? (
							<div>
								{(content.type === "canvas" ||
									content.type === "canvas-live" ||
									content.type === "canvas-export") && (
										<div className="flex items-center gap-2 text-sm">
											<Brush className="h-4 w-4 text-muted-foreground" />
											<span>
												Canvas:{" "}
												{content.canvasName ||
													content.roomId?.split("-").slice(1, -1).join("-") ||
													"Untitled Canvas"}
											</span>
										</div>
									)}
								{(content.type === "note" ||
									content.type === "note-live" ||
									content.type === "note-export") && (
										<div className="flex items-center gap-2 text-sm">
											<FileText className="h-4 w-4 text-muted-foreground" />
											<span>Note: {content.noteTitle || "Untitled Note"}</span>
										</div>
									)}
							</div>
						) : (
							<p className="text-sm">{content}</p>
						)}
						<div className="flex items-center justify-end mt-2">
							<span className="text-xs text-muted-foreground">
								{format(new Date(message._creationTime), "MMM d, h:mm a")}
							</span>
						</div>
					</div>
				</div>
			</Link>
		);
	}
}
