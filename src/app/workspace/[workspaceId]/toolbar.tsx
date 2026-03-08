"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Bell,
	Calendar,
	CheckSquare,
	FileText,
	LayoutList,
	Loader2,
	MessageSquare,
	Search,
	Sparkles,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import {
	type ChangeEvent,
	type KeyboardEvent as ReactKeyboardEvent,
	type ReactNode,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import { Hint } from "@/components/hint";
import { MentionsNotificationDialog } from "@/components/mentions-notification-dialog";
import ThemeToggle from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	CommandDialog,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
import { UserButton } from "@/features/auth/components/user-button";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetUnreadMentionsCount } from "@/features/messages/api/use-get-unread-mentions-count";
import { useAISearch } from "@/features/workspaces/api/use-ai-search";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useSearchMessages } from "@/features/workspaces/api/use-search-messages";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useBoardSearchStore } from "@/features/board/store/use-board-search";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";

interface WorkspaceToolbarProps {
	children: ReactNode;
}

interface SearchDialogContentProps {
	workspaceName?: string;
	searchQuery: string;
	useAI: boolean;
	aiSearchInput: string;
	isAISearching: boolean;
	isSearching: boolean;
	aiResult?: {
		success?: boolean;
		answer?: string | null;
		sources?: string[];
		error?: string | null;
	} | null;
	searchResults: {
		messages?: Array<{
			_id: Id<"messages">;
			text: string;
			channelId?: Id<"channels">;
			channelName: string;
			_creationTime: number;
		}>;
		notes?: Array<{
			_id: Id<"notes">;
			title: string;
			channelId: Id<"channels">;
		}>;
		tasks?: Array<{ _id: Id<"tasks">; title: string }>;
		cards?: Array<{
			_id: Id<"cards">;
			title: string;
			channelId: Id<"channels">;
		}>;
		events?: Array<{ _id: Id<"events">; title: string; time?: string }>;
	};
	boardSearchResults?: {
		issues: Array<{
			_id: Id<"issues">;
			title: string;
			channelId: Id<"channels">;
			type: "issue";
		}>;
		statuses: Array<{
			_id: Id<"statuses">;
			name: string;
			color: string;
			type: "status";
		}>;
	} | null;
	isBoardPage: boolean;
	channels?: Array<{ _id: Id<"channels">; name: string }>;
	members?: Array<{ _id: Id<"members">; user: { name?: string } }>;
	aiInputRef: React.RefObject<HTMLInputElement>;
	onSearchQueryChange: (value: string) => void;
	onToggleAI: () => void;
	onAiInputChange: (event: ChangeEvent<HTMLInputElement>) => void;
	onAiInputKeyDown: (event: ReactKeyboardEvent<HTMLInputElement>) => void;
	onAiResultSelect: () => void;
	onCommandSelect: (value: string) => void;
	onAiSearch: (query: string) => void;
}

const SearchDialogContent = ({
	workspaceName,
	searchQuery,
	useAI,
	aiSearchInput,
	isAISearching,
	isSearching,
	aiResult,
	searchResults,
	boardSearchResults,
	isBoardPage,
	channels,
	members,
	aiInputRef,
	onSearchQueryChange,
	onToggleAI,
	onAiInputChange,
	onAiInputKeyDown,
	onAiResultSelect,
	onCommandSelect,
	onAiSearch,
}: SearchDialogContentProps) => {
	const handleAiSubmit = useCallback(
		(e: React.FormEvent) => {
			e.preventDefault();
			if (isAISearching) return;
			if (aiSearchInput.trim()) {
				onAiSearch(aiSearchInput.trim());
			}
		},
		[aiSearchInput, isAISearching, onAiSearch]
	);

	const mapAiErrorToMessage = useCallback((error?: string | null) => {
		if (!error) return "Failed to search with AI";
		if (error === "AI_SERVICE_NOT_CONFIGURED") {
			return "The AI service is not configured. Please contact your administrator.";
		}
		if (error.includes("not found") || error.includes("not supported")) {
			return "Selected OpenAI model is unavailable for this API version.";
		}
		if (error.includes("quota")) {
			return "OpenAI quota/rate limit exceeded. Check billing/limits or retry later.";
		}
		return "Failed to search with AI";
	}, []);

	useEffect(() => {
		if (aiResult?.success === false && aiResult.error) {
			console.error("AI search error:", aiResult.error);
		}
	}, [aiResult?.error, aiResult?.success]);

	const messages = searchResults.messages ?? [];
	const notes = searchResults.notes ?? [];
	const tasks = searchResults.tasks ?? [];
	const cards = searchResults.cards ?? [];
	const events = searchResults.events ?? [];

	return (
		<>
			<div className="flex items-center gap-2 border-b px-3 py-2">
				<Button
					aria-label={useAI ? "Disable AI search" : "Enable AI search"}
					aria-pressed={useAI}
					className={`px-2 ${useAI ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
					onClick={onToggleAI}
					size="sm"
					title="Toggle AI Search"
					variant="ghost"
				>
					<Sparkles className="h-4 w-4" />
				</Button>
				<div className="flex-1">
					{useAI ? (
						<form onSubmit={handleAiSubmit}>
							<input
								className="flex h-11 w-full rounded-md bg-transparent py-3 text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
								onChange={onAiInputChange}
								onKeyDown={onAiInputKeyDown}
								placeholder={`Ask AI about ${workspaceName ?? "workspace"}...`}
								ref={aiInputRef}
								value={aiSearchInput}
							/>
						</form>
					) : (
						<CommandInput
							onValueChange={onSearchQueryChange}
							placeholder={`Search ${workspaceName ?? "workspace"}...`}
							value={searchQuery}
						/>
					)}
				</div>
			</div>
			<CommandList>
				{useAI && (
					<>
						{isAISearching && (
							<CommandEmpty>
								<div className="flex items-center justify-center gap-2 py-6">
									<Loader2 className="size-4 animate-spin" />
									<span>Searching with AI...</span>
								</div>
							</CommandEmpty>
						)}

						{aiResult?.success && !isAISearching && (
							<CommandGroup heading="AI Answer">
								<CommandItem
									className="cursor-default p-4 text-sm space-y-3 flex-col items-stretch data-[selected=true]:bg-transparent"
									onSelect={onAiResultSelect}
									value="ai-answer"
								>
									<div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
										<p className="text-sm leading-relaxed text-foreground whitespace-pre-line">
											{aiResult.answer}
										</p>
									</div>
									{aiResult.sources && aiResult.sources.length > 0 && (
										<div className="text-xs text-muted-foreground">
											<p className="font-semibold mb-1">Sources:</p>
											<div className="flex flex-wrap gap-1">
												{aiResult.sources.map((source) => (
													<Badge
														className="text-xs"
														key={source}
														variant="outline"
													>
														{source}
													</Badge>
												))}
											</div>
										</div>
									)}
								</CommandItem>
							</CommandGroup>
						)}

						{aiResult?.success === false && !isAISearching && (
							<CommandEmpty>
								<div className="p-4 text-center">
									<p className="text-sm text-destructive">
										{mapAiErrorToMessage(aiResult.error)}
									</p>
								</div>
							</CommandEmpty>
						)}

						{!aiSearchInput.trim() && !isAISearching && !aiResult && (
							<CommandEmpty>
								<div className="p-4 text-center text-muted-foreground text-sm">
									Type your question above and press Enter to search with AI
								</div>
							</CommandEmpty>
						)}
					</>
				)}

				{!useAI && isSearching && (
					<CommandEmpty>
						<div className="flex items-center justify-center gap-2 py-6">
							<Loader2 className="size-4 animate-spin" />
							<span>Searching...</span>
						</div>
					</CommandEmpty>
				)}

				{!useAI && searchQuery && messages.length > 0 && !isSearching && (
					<CommandGroup heading="Messages">
						{messages.map((result) => (
							<CommandItem
								key={result._id}
								onSelect={onCommandSelect}
								value={`message:${result._id}:${result.channelId ?? ""}`}
							>
								<MessageSquare className="mr-2 size-4 shrink-0" />
								<div className="flex flex-col gap-1 flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-xs text-muted-foreground">
											#{result.channelName}
										</span>
										<span className="text-xs text-muted-foreground">
											{formatDistanceToNow(result._creationTime, {
												addSuffix: true,
											})}
										</span>
									</div>
									<span className="truncate text-sm">
										{result.text.slice(0, 120)}
										{result.text.length > 120 ? "..." : ""}
									</span>
								</div>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!useAI && searchQuery && notes.length > 0 && !isSearching && (
					<CommandGroup heading="Notes">
						{notes.map((note) => (
							<CommandItem
								key={note._id}
								onSelect={onCommandSelect}
								value={`note:${note._id}:${note.channelId}`}
							>
								<FileText className="mr-2 size-4 shrink-0" />
								<span className="truncate">{note.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!useAI && searchQuery && tasks.length > 0 && !isSearching && (
					<CommandGroup heading="Tasks">
						{tasks.map((task) => (
							<CommandItem
								key={task._id}
								onSelect={onCommandSelect}
								value={`task:${task._id}`}
							>
								<CheckSquare className="mr-2 size-4 shrink-0" />
								<span className="truncate">{task.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!useAI && searchQuery && cards.length > 0 && !isSearching && (
					<CommandGroup heading="Cards">
						{cards.map((card) => (
							<CommandItem
								key={card._id}
								onSelect={onCommandSelect}
								value={`card:${card._id}:${card.channelId}`}
							>
								<LayoutList className="mr-2 size-4 shrink-0" />
								<span className="truncate">{card.title}</span>
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!useAI && isBoardPage && boardSearchResults && searchQuery && !isSearching && (
					<>
						{boardSearchResults.issues.length > 0 && (
							<CommandGroup heading="Issues">
								{boardSearchResults.issues.map((issue) => (
									<CommandItem
										key={issue._id}
										onSelect={onCommandSelect}
										value={`issue:${issue._id}:${issue.channelId}`}
									>
										<LayoutList className="mr-2 size-4 shrink-0" />
										<span className="truncate">{issue.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
						{boardSearchResults.statuses.length > 0 && (
							<CommandGroup heading="Statuses">
								{boardSearchResults.statuses.map((status) => (
									<CommandItem
										key={status._id}
										onSelect={onCommandSelect}
										value={`status:${status._id}`}
									>
										<div
											className="w-2 h-2 rounded-full mr-2"
											style={{ backgroundColor: status.color }}
										/>
										<span className="truncate">{status.name}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}
					</>
				)}

				{!useAI && searchQuery && events.length > 0 && !isSearching && (
					<CommandGroup heading="Calendar">
						{events.map((event) => (
							<CommandItem
								key={event._id}
								onSelect={onCommandSelect}
								value={`event:${event._id}`}
							>
								<Calendar className="mr-2 size-4 shrink-0" />
								<span className="truncate">{event.title}</span>
								{event.time && (
									<span className="text-xs text-muted-foreground ml-1">
										{event.time}
									</span>
								)}
							</CommandItem>
						))}
					</CommandGroup>
				)}

				{!useAI &&
					searchQuery &&
					messages.length === 0 &&
					notes.length === 0 &&
					tasks.length === 0 &&
					cards.length === 0 &&
					events.length === 0 &&
					!isSearching && <CommandEmpty>No results found.</CommandEmpty>}

				{!useAI && !searchQuery && (
					<>
						<CommandEmpty>No results found.</CommandEmpty>

						<CommandGroup heading="Channels">
							{channels?.map((channel) => (
								<CommandItem
									key={channel._id}
									onSelect={onCommandSelect}
									value={`channel:${channel._id}`}
								>
									{channel.name}
								</CommandItem>
							))}
						</CommandGroup>

						<CommandSeparator />

						<CommandGroup heading="Members">
							{members?.map((member) => (
								<CommandItem
									key={member._id}
									onSelect={onCommandSelect}
									value={`member:${member._id}`}
								>
									{member.user.name || "Unknown"}
								</CommandItem>
							))}
						</CommandGroup>
					</>
				)}
			</CommandList>
		</>
	);
};

export const WorkspaceToolbar = ({ children }: WorkspaceToolbarProps) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const pathname = usePathname();
	const workspaceId = useWorkspaceId();
	const [searchOpen, setSearchOpen] = useWorkspaceSearch();
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [forceOpenUserSettings, setForceOpenUserSettings] = useState(false);
	const [userSettingsTab, setUserSettingsTab] = useState<
		"profile" | "notifications"
	>("profile");

	// Board search integration
	const { isBoardPage, boardSearchQuery, setBoardSearchQuery } = useBoardSearchStore();
	const channelId = usePathname().match(/\/channel\/([^/]+)/)?.[1] as Id<"channels"> | undefined;

	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [useAI, setUseAI] = useState(false);
	const [aiSearchInput, setAiSearchInput] = useState("");
	const aiInputRef = useRef<HTMLInputElement | null>(null);

	const { data: workspace } = useGetWorkspace({ id: workspaceId });
	const { data: channels } = useGetChannels({ workspaceId });
	const { data: members } = useGetMembers({ workspaceId });
	const { counts, isLoading: isLoadingMentions } = useGetUnreadMentionsCount();

	// Board search when on board page
	const boardSearchResults = useQuery(
		api.board.searchBoardContent,
		isBoardPage && channelId && searchQuery.trim()
			? { channelId: channelId as Id<"channels">, query: searchQuery }
			: "skip"
	);

	const { results: searchResults, isLoading: isSearching } = useSearchMessages({
		workspaceId,
		query: useAI || isBoardPage ? "" : searchQuery,
		enabled: (!useAI && !isBoardPage && searchQuery.trim().length > 0) || false,
	});

	const {
		search: aiSearch,
		isLoading: isAISearching,
		result: aiResult,
		reset: resetAISearch,
	} = useAISearch(workspaceId);

	// Reset search state when dialog closes
	useEffect(() => {
		if (!searchOpen) {
			setSearchQuery("");
			setUseAI(false);
			setAiSearchInput("");
			resetAISearch();
		}
	}, [searchOpen, resetAISearch]);

	// Sync search query with board search when on board page
	useEffect(() => {
		if (isBoardPage) {
			setBoardSearchQuery(searchQuery);
		}
	}, [isBoardPage, searchQuery, setBoardSearchQuery]);

	useEffect(() => {
		if (searchOpen && useAI) {
			aiInputRef.current?.focus();
		}
	}, [searchOpen, useAI]);

	// Handle URL parameter for opening user settings
	useEffect(() => {
		const openUserSettings = searchParams.get("openUserSettings");
		if (
			openUserSettings === "profile" ||
			openUserSettings === "notifications"
		) {
			setUserSettingsTab(openUserSettings);
			setForceOpenUserSettings(true);

			// Clean up URL parameter
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete("openUserSettings");
			router.replace(newUrl.pathname + newUrl.search);
		}
	}, [searchParams, router]);

	const handleUserSettingsClose = () => {
		setForceOpenUserSettings(false);
	};

	const onChannelClick = useCallback(
		(channelId: Id<"channels">) => {
			setSearchOpen(false);
			router.push(`/workspace/${workspaceId}/channel/${channelId}/chats`);
		},
		[router, setSearchOpen, workspaceId]
	);

	const onMemberClick = useCallback(
		(memberId: Id<"members">) => {
			setSearchOpen(false);
			router.push(`/workspace/${workspaceId}/member/${memberId}`);
		},
		[router, setSearchOpen, workspaceId]
	);

	const onMessageClick = useCallback(
		(messageId: Id<"messages">, channelId: Id<"channels"> | undefined) => {
			setSearchOpen(false);
			if (channelId) {
				router.push(
					`/workspace/${workspaceId}/channel/${channelId}/chats?highlight=${messageId}`
				);
			} else {
				router.push(`/workspace/${workspaceId}/threads`);
			}
		},
		[router, setSearchOpen, workspaceId]
	);

	const handleSearchOpen = useCallback(() => {
		setSearchOpen(true);
	}, [setSearchOpen]);

	const handleNotificationsOpen = useCallback(() => {
		setNotificationsOpen(true);
	}, []);

	const handleToggleAI = useCallback(() => {
		setUseAI((current) => !current);
		setSearchQuery("");
		setAiSearchInput("");
		resetAISearch();
	}, [resetAISearch]);

	const handleAiInputChange = useCallback(
		(event: ChangeEvent<HTMLInputElement>) => {
			setAiSearchInput(event.target.value);
		},
		[]
	);

	const handleAiInputKeyDown = useCallback(
		(event: ReactKeyboardEvent<HTMLInputElement>) => {
			if (event.key === "Escape") {
				event.preventDefault();
				setSearchOpen(false);
			}
		},
		[setSearchOpen]
	);

	const handleAiResultSelect = useCallback(() => {
		aiInputRef.current?.focus();
	}, []);

	const handleCommandSelect = useCallback(
		(value: string) => {
			const [type, id, extra] = value.split(":");

			switch (type) {
				case "message": {
					onMessageClick(
						id as Id<"messages">,
						extra ? (extra as Id<"channels">) : undefined
					);
					break;
				}
				case "note": {
					if (extra) {
						setSearchOpen(false);
						router.push(
							`/workspace/${workspaceId}/channel/${extra}/notes/${id}`
						);
					}
					break;
				}
				case "task": {
					setSearchOpen(false);
					router.push(`/workspace/${workspaceId}/tasks`);
					break;
				}
				case "card": {
					if (extra) {
						setSearchOpen(false);
						router.push(`/workspace/${workspaceId}/channel/${extra}/board`);
					}
					break;
				}
				case "event": {
					setSearchOpen(false);
					router.push(`/workspace/${workspaceId}/calendar`);
					break;
				}
				case "issue": {
					// For issues, we navigate to board page
					// The issue will be highlighted/opened via a future enhancement
					if (extra) {
						setSearchOpen(false);
						router.push(`/workspace/${workspaceId}/channel/${extra}/board`);
					}
					break;
				}
				case "status": {
					// For statuses, navigate to board page
					if (extra) {
						setSearchOpen(false);
						router.push(`/workspace/${workspaceId}/channel/${extra}/board`);
					}
					break;
				}
				case "channel": {
					onChannelClick(id as Id<"channels">);
					break;
				}
				case "member": {
					onMemberClick(id as Id<"members">);
					break;
				}
				default:
					break;
			}
		},
		[
			onChannelClick,
			onMemberClick,
			onMessageClick,
			router,
			setSearchOpen,
			workspaceId,
		]
	);

	useEffect(() => {
		const down = (e: KeyboardEvent) => {
			if (e.key === "k" && (e.metaKey || e.ctrlKey)) {
				e.preventDefault();
				setSearchOpen((open) => !open);
			}
		};
		document.addEventListener("keydown", down);
		return () => document.removeEventListener("keydown", down);
	}, [setSearchOpen]);

	return (
		<nav className="workspace-topbar sticky top-0 z-50 flex h-16 w-full min-w-0 max-w-full items-center overflow-x-hidden overflow-y-visible border-b bg-primary text-secondary-foreground shadow-md ml-[-2px]">
			{/* Left section - Entity info (Channel/Member/etc) */}
			<div className="flex items-center px-2 md:px-6">{children}</div>

			{/* Middle section - Search - Hidden on mobile */}
			<div className="hidden md:block min-w-[280px] max-w-[642px] shrink grow-[2] px-4">
				<Button
					className="h-9 w-full justify-start bg-white/10 px-3 hover:bg-white/20 transition-standard border border-white/10 rounded-[10px]"
					onClick={handleSearchOpen}
					size="sm"
				>
					<Search className="mr-2 size-4 text-white" />
					<span className="text-xs text-white">
						Search {workspace?.name ?? "workspace"}...
					</span>
					<kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-90">
						<span className="text-xs">⌘</span>K
					</kbd>
				</Button>

				<CommandDialog
					onOpenChange={setSearchOpen}
					open={searchOpen}
					shouldFilter={false}
				>
					<SearchDialogContent
						aiInputRef={aiInputRef}
						aiResult={aiResult}
						aiSearchInput={aiSearchInput}
						boardSearchResults={boardSearchResults}
						channels={channels}
						isAISearching={isAISearching}
						isBoardPage={isBoardPage}
						isSearching={isSearching}
						members={members}
						onAiInputChange={handleAiInputChange}
						onAiInputKeyDown={handleAiInputKeyDown}
						onAiResultSelect={handleAiResultSelect}
						onAiSearch={aiSearch}
						onCommandSelect={handleCommandSelect}
						onSearchQueryChange={setSearchQuery}
						onToggleAI={handleToggleAI}
						searchQuery={searchQuery}
						searchResults={searchResults}
						useAI={useAI}
						workspaceName={workspace?.name}
					/>
				</CommandDialog>
			</div>

			{/* Right section - Actions */}
			<div className="ml-auto flex flex-1 items-center justify-end gap-x-1.5 md:gap-x-3 px-3 md:px-6">
				{/* Mobile Search Button */}
				<div className="md:hidden">
					<Button
						aria-label="Open search"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={handleSearchOpen}
						size="iconSm"
						variant="ghost"
					>
						<Search className="size-5" />
					</Button>
				</div>

				{/* Notifications Button */}
				<Hint label="Notifications" side="bottom">
					<Button
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={handleNotificationsOpen}
						size="iconSm"
						variant="ghost"
					>
						<div className="relative">
							<Bell className="size-5" />
							{!isLoadingMentions && counts && counts.total > 0 && (
								<Badge
									className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 border border-white shadow-sm text-[10px]"
									variant="default"
								>
									{counts.total > 9 ? "9+" : counts.total}
								</Badge>
							)}
						</div>
					</Button>
				</Hint>

				{/* Notification Dialog */}
				<MentionsNotificationDialog
					onOpenChange={setNotificationsOpen}
					open={notificationsOpen}
				/>

				<ThemeToggle />

				{/* UserButton - Always visible (moved from footer on mobile) */}
				<UserButton
					defaultTab={userSettingsTab}
					forceOpenSettings={forceOpenUserSettings}
					onSettingsClose={handleUserSettingsClose}
				/>
			</div>
		</nav>
	);
};
