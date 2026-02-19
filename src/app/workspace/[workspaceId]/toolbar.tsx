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
import { type ReactNode, useEffect, useState } from "react";

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
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useSearchMessages } from "@/features/workspaces/api/use-search-messages";
import { useAISearch } from "@/features/workspaces/api/use-ai-search";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";

import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface WorkspaceToolbarProps {
	children: ReactNode;
}

export const WorkspaceToolbar = ({ children }: WorkspaceToolbarProps) => {
	const router = useRouter();
	const searchParams = useSearchParams();
	const workspaceId = useWorkspaceId();
	const [searchOpen, setSearchOpen] = useWorkspaceSearch();
	const [notificationsOpen, setNotificationsOpen] = useState(false);
	const [forceOpenUserSettings, setForceOpenUserSettings] = useState(false);
	const [userSettingsTab, setUserSettingsTab] = useState<
		"profile" | "notifications"
	>("profile");
	
	// Search state
	const [searchQuery, setSearchQuery] = useState("");
	const [useAI, setUseAI] = useState(false);
	const [aiSearchInput, setAiSearchInput] = useState("");

	const { data: workspace } = useGetWorkspace({ id: workspaceId });
	const { data: channels } = useGetChannels({ workspaceId });
	const { data: members } = useGetMembers({ workspaceId });
	const { counts, isLoading: isLoadingMentions } = useGetUnreadMentionsCount();

	const { results: searchResults, isLoading: isSearching } = useSearchMessages({
		workspaceId,
		query: useAI ? "" : searchQuery,
		enabled: !useAI && searchQuery.trim().length > 0,
	});

	const { search: aiSearch, isLoading: isAISearching, result: aiResult } = useAISearch(workspaceId);

	// Reset search state when dialog closes
	useEffect(() => {
		if (!searchOpen) {
			setSearchQuery("");
			setUseAI(false);
			setAiSearchInput("");
		}
	}, [searchOpen]);

	// Handle URL parameter for opening user settings
	useEffect(() => {
		const openUserSettings = searchParams.get("openUserSettings");
		if (openUserSettings) {
			setUserSettingsTab(openUserSettings as "profile" | "notifications");
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

	const onChannelClick = (channelId: Id<"channels">) => {
		setSearchOpen(false);
		router.push(`/workspace/${workspaceId}/channel/${channelId}/chats`);
	};

	const onMemberClick = (memberId: Id<"members">) => {
		setSearchOpen(false);
		router.push(`/workspace/${workspaceId}/member/${memberId}`);
	};

	const onMessageClick = (
		messageId: Id<"messages">,
		channelId: Id<"channels"> | undefined
	) => {
		setSearchOpen(false);
		if (channelId) {
			router.push(
				`/workspace/${workspaceId}/channel/${channelId}/chats?highlight=${messageId}`
			);
		} else {
			router.push(`/workspace/${workspaceId}/threads`);
		}
	};

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
		<nav className="workspace-topbar sticky top-0 z-50 flex h-16 items-center overflow-hidden border-b bg-primary text-secondary-foreground shadow-md ml-[-2px]">
			{/* Left section - Entity info (Channel/Member/etc) */}
			<div className="flex items-center px-2 md:px-6">{children}</div>

			{/* Middle section - Search - Hidden on mobile */}
			<div className="hidden md:block min-w-[280px] max-w-[642px] shrink grow-[2] px-4">
				<Button
					className="h-9 w-full justify-start bg-white/10 px-3 hover:bg-white/20 transition-standard border border-white/10 rounded-[10px]"
					onClick={() => setSearchOpen(true)}
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
					<div className="flex items-center gap-2 border-b px-3 py-2">
						<div className="flex-1">
							{useAI ? (
								<input
									autoFocus
									className="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
									onChange={(e) => setAiSearchInput(e.target.value)}
									onKeyDown={(e) => {
										if (e.key === "Enter" && aiSearchInput.trim()) {
											aiSearch(aiSearchInput);
										}
									}}
									placeholder={`Ask AI about ${workspace?.name ?? "workspace"}...`}
									value={aiSearchInput}
								/>
							) : (
								<CommandInput
									onValueChange={setSearchQuery}
									placeholder={`Search ${workspace?.name ?? "workspace"}...`}
									value={searchQuery}
								/>
							)}
						</div>
						<Button
							className={`px-2 ${useAI ? "bg-primary text-white" : "bg-muted text-muted-foreground hover:bg-muted/80"}`}
							onClick={() => {
								setUseAI(!useAI);
								setSearchQuery("");
								setAiSearchInput("");
							}}
							size="sm"
							title="Toggle AI Search"
							variant="ghost"
						>
							<Sparkles className="h-4 w-4" />
						</Button>
					</div>
					<CommandList>
						{/* AI Search Results */}
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

								{aiResult && aiResult.success && !isAISearching && (
									<CommandGroup heading="AI Answer">
										<div className="p-4 text-sm space-y-3">
											<div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
												<p className="text-sm leading-relaxed text-foreground">
													{aiResult.answer}
												</p>
											</div>
											<div className="text-xs text-muted-foreground">
												<p className="font-semibold mb-1">Sources:</p>
												<div className="flex flex-wrap gap-1">
													{aiResult.sources?.map((source) => (
														<Badge
															key={source}
															variant="outline"
															className="text-xs"
														>
															{source}
														</Badge>
													))}
												</div>
											</div>
										</div>
									</CommandGroup>
								)}

								{aiResult && !aiResult.success && !isAISearching && (
									<CommandEmpty>
										<div className="p-4 text-center">
											<p className="text-sm text-destructive">
												{aiResult.error || "Failed to search with AI"}
											</p>
											{(aiResult.error?.includes("not configured") ||
												aiResult.error?.includes("OPENROUTER_API_KEY")) && (
												<p className="text-xs text-muted-foreground mt-2">
													Make sure you have set the OPENROUTER_API_KEY
													environment variable.
												</p>
											)}
											{(aiResult.error?.includes("not found") ||
												aiResult.error?.includes("not supported")) && (
												<p className="text-xs text-muted-foreground mt-2">
													Selected OpenRouter model is unavailable for this API version.
												</p>
											)}
											{aiResult.error?.includes("quota") && (
												<p className="text-xs text-muted-foreground mt-2">
													OpenRouter quota/rate limit exceeded. Check billing/limits or retry later.
												</p>
											)}
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

						{/* Regular Search Results - only show when not using AI */}
						{!useAI && isSearching && (
							<CommandEmpty>
								<div className="flex items-center justify-center gap-2 py-6">
									<Loader2 className="size-4 animate-spin" />
									<span>Searching...</span>
								</div>
							</CommandEmpty>
						)}

						{!useAI && searchQuery && searchResults.messages?.length > 0 && !isSearching && (
							<CommandGroup heading="Messages">
								{searchResults.messages.map((result) => (
									<CommandItem
										key={result._id}
										onSelect={() =>
											onMessageClick(result._id, result.channelId)
										}
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

						{!useAI && searchQuery && searchResults.notes?.length > 0 && !isSearching && (
							<CommandGroup heading="Notes">
								{searchResults.notes.map((note) => (
									<CommandItem
										key={note._id}
										onSelect={() => {
											setSearchOpen(false);
											router.push(
												`/workspace/${workspaceId}/channel/${note.channelId}/notes/${note._id}`
											);
										}}
									>
										<FileText className="mr-2 size-4 shrink-0" />
										<span className="truncate">{note.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{!useAI && searchQuery && searchResults.tasks?.length > 0 && !isSearching && (
							<CommandGroup heading="Tasks">
								{searchResults.tasks.map((task) => (
									<CommandItem
										key={task._id}
										onSelect={() => {
											setSearchOpen(false);
											router.push(`/workspace/${workspaceId}/tasks`);
										}}
									>
										<CheckSquare className="mr-2 size-4 shrink-0" />
										<span className="truncate">{task.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{!useAI && searchQuery && searchResults.cards?.length > 0 && !isSearching && (
							<CommandGroup heading="Cards">
								{searchResults.cards.map((card) => (
									<CommandItem
										key={card._id}
										onSelect={() => {
											setSearchOpen(false);
											router.push(
												`/workspace/${workspaceId}/channel/${card.channelId}/board`
											);
										}}
									>
										<LayoutList className="mr-2 size-4 shrink-0" />
										<span className="truncate">{card.title}</span>
									</CommandItem>
								))}
							</CommandGroup>
						)}

						{!useAI && searchQuery && searchResults.events?.length > 0 && !isSearching && (
							<CommandGroup heading="Calendar">
								{searchResults.events.map((event) => (
									<CommandItem
										key={event._id}
										onSelect={() => {
											setSearchOpen(false);
											router.push(`/workspace/${workspaceId}/calendar`);
										}}
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

						{!useAI && searchQuery &&
							searchResults.messages?.length === 0 &&
							searchResults.notes?.length === 0 &&
							searchResults.tasks?.length === 0 &&
							searchResults.cards?.length === 0 &&
							searchResults.events?.length === 0 &&
							!isSearching && <CommandEmpty>No results found.</CommandEmpty>}

						{!useAI && !searchQuery && (
							<>
								<CommandEmpty>No results found.</CommandEmpty>

								<CommandGroup heading="Channels">
									{channels?.map((channel) => (
										<CommandItem
											key={channel._id}
											onSelect={() => onChannelClick(channel._id)}
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
											onSelect={() => onMemberClick(member._id)}
										>
											{member.user.name}
										</CommandItem>
									))}
								</CommandGroup>
							</>
						)}
					</CommandList>
				</CommandDialog>
			</div>

			{/* Right section - Actions */}
			<div className="ml-auto flex flex-1 items-center justify-end gap-x-1.5 md:gap-x-3 px-3 md:px-6">
				{/* Mobile Search Button */}
				<div className="md:hidden">
					<Button
						aria-label="Open search"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => setSearchOpen(true)}
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
						onClick={() => setNotificationsOpen(true)}
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
