"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Bell,
	HeartPulse,
	HelpCircle,
	Loader2,
	Map as MapIcon,
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
import { useAiSearch } from "@/features/workspaces/api/use-ai-search";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useSearchMessages } from "@/features/workspaces/api/use-search-messages";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";

import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { showTidioChat } from "@/lib/tidio-helpers";

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
	const [isAiMode, setIsAiMode] = useState(false);
	const [aiResults, setAiResults] = useState<{
		answer: string;
		sources: Array<{
			id: Id<"messages">;
			text: string;
			channelId: Id<"channels">;
			channelName: string;
		}>;
	} | null>(null);
	const [isAiLoading, setIsAiLoading] = useState(false);

	const { data: workspace } = useGetWorkspace({ id: workspaceId });
	const { data: channels } = useGetChannels({ workspaceId });
	const { data: members } = useGetMembers({ workspaceId });
	const { counts, isLoading: isLoadingMentions } = useGetUnreadMentionsCount();

	// Normal search hook
	const actualQuery = isAiMode ? "" : searchQuery;
	const { results: searchResults, isLoading: isSearching } = useSearchMessages({
		workspaceId,
		query: actualQuery,
		enabled: !isAiMode && searchQuery.trim().length > 0,
	});

	// AI search hook
	const { searchWithAi } = useAiSearch();

	// Handle search input changes
	const handleSearchChange = (value: string) => {
		setSearchQuery(value);

		// Detect AI mode
		if (value.startsWith("/ai ")) {
			setIsAiMode(true);
		} else {
			setIsAiMode(false);
			setAiResults(null); // Clear AI results when switching to normal mode
		}
	};

	// Handle AI search trigger (on Enter key)
	const handleAiSearch = async () => {
		if (!isAiMode || !searchQuery.startsWith("/ai ")) return;

		const query = searchQuery.replace("/ai ", "").trim();
		if (!query) return;

		setIsAiLoading(true);
		try {
			const result = await searchWithAi({
				workspaceId,
				query,
			});
			setAiResults(result);
		} catch (error) {
			console.error("AI search error:", error);
			setAiResults({
				answer: "Failed to generate AI response. Please try again.",
				sources: [],
			});
		} finally {
			setIsAiLoading(false);
		}
	};

	// Reset search state when dialog closes
	useEffect(() => {
		if (!searchOpen) {
			setSearchQuery("");
			setIsAiMode(false);
			setAiResults(null);
			setIsAiLoading(false);
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
		channelId: Id<"channels">
	) => {
		setSearchOpen(false);
		router.push(
			`/workspace/${workspaceId}/channel/${channelId}/chats?highlight=${messageId}`
		);
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
			<div className="flex items-center px-6">{children}</div>

			{/* Middle section - Search */}
			<div className="min-w-[280px] max-w-[642px] shrink grow-[2] px-4">
				<Button
					onClick={() => setSearchOpen(true)}
					size="sm"
					className="h-9 w-full justify-start bg-white/10 px-3 hover:bg-white/20 transition-standard border border-white/10 rounded-[10px]"
				>
					<Search className="mr-2 size-4 text-white" />
					<span className="text-xs text-white">
						Search {workspace?.name ?? "workspace"}...
					</span>
					<kbd className="pointer-events-none ml-auto inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-90">
						<span className="text-xs">⌘</span>K
					</kbd>
				</Button>

				<CommandDialog open={searchOpen} onOpenChange={setSearchOpen}>
					<CommandInput
						placeholder={
							isAiMode
								? "AI Search (press Enter to search)..."
								: `Search ${workspace?.name ?? "workspace"}... (or type /ai for AI search)`
						}
						value={searchQuery}
						onValueChange={handleSearchChange}
						onKeyDown={(e) => {
							if (e.key === "Enter" && isAiMode) {
								e.preventDefault();
								handleAiSearch();
							}
						}}
					/>
					<CommandList>
						{/* Loading state */}
						{(isSearching || isAiLoading) && (
							<CommandEmpty>
								<div className="flex items-center justify-center gap-2 py-6">
									<Loader2 className="size-4 animate-spin" />
									<span>
										{isAiLoading ? "Generating AI response..." : "Searching..."}
									</span>
								</div>
							</CommandEmpty>
						)}

						{/* AI Mode Results */}
						{isAiMode && aiResults && !isAiLoading && (
							<>
								<CommandGroup heading="AI Summary">
									<div className="px-2 py-3 text-sm">
										<div className="flex items-start gap-2">
											<Sparkles className="size-4 mt-0.5 text-purple-500 shrink-0" />
											<p className="text-muted-foreground whitespace-pre-wrap">
												{aiResults.answer}
											</p>
										</div>
									</div>
								</CommandGroup>

								{aiResults.sources.length > 0 && (
									<>
										<CommandSeparator />
										<CommandGroup heading="Sources">
											{aiResults.sources.map((source) => (
												<CommandItem
													key={source.id}
													onSelect={() =>
														onMessageClick(source.id, source.channelId)
													}
												>
													<MessageSquare className="mr-2 size-4" />
													<div className="flex flex-col gap-1 flex-1 min-w-0">
														<span className="text-xs text-muted-foreground">
															#{source.channelName}
														</span>
														<span className="truncate text-sm">
															{source.text.slice(0, 100)}
															{source.text.length > 100 ? "..." : ""}
														</span>
													</div>
												</CommandItem>
											))}
										</CommandGroup>
									</>
								)}
							</>
						)}

						{/* Normal Search Results */}
						{!isAiMode &&
							searchQuery &&
							searchResults.length > 0 &&
							!isSearching && (
								<CommandGroup heading="Messages">
									{searchResults.map((result) => (
										<CommandItem
											key={result._id}
											onSelect={() =>
												onMessageClick(
													result._id,
													result.channelId as Id<"channels">
												)
											}
										>
											<MessageSquare className="mr-2 size-4" />
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

						{/* Empty state for normal search */}
						{!isAiMode &&
							searchQuery &&
							searchResults.length === 0 &&
							!isSearching && <CommandEmpty>No messages found.</CommandEmpty>}

						{/* AI mode waiting for Enter */}
						{isAiMode && !aiResults && !isAiLoading && (
							<CommandEmpty>
								<div className="flex items-center justify-center gap-2 py-6">
									<Sparkles className="size-4 text-purple-500" />
									<span>Press Enter to run AI search</span>
								</div>
							</CommandEmpty>
						)}

						{/* Default state - show channels and members */}
						{!searchQuery && (
							<>
								<CommandEmpty>No results found.</CommandEmpty>

								<CommandGroup heading="Channels">
									{channels?.map((channel) => (
										<CommandItem
											onSelect={() => onChannelClick(channel._id)}
											key={channel._id}
										>
											{channel.name}
										</CommandItem>
									))}
								</CommandGroup>

								<CommandSeparator />

								<CommandGroup heading="Members">
									{members?.map((member) => (
										<CommandItem
											onSelect={() => onMemberClick(member._id)}
											key={member._id}
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
			<div className="ml-auto flex flex-1 items-center justify-end gap-x-3 px-6">
				{/* Roadmap Button */}
				<Hint label="Roadmap & Feedback" side="bottom">
					<Button
						variant="ghost"
						size="iconSm"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open roadmap page in a new tab
							const roadmapUrl = process.env.NEXT_PUBLIC_ROADMAP_URL!;
							window.open(roadmapUrl, "_blank", "noopener,noreferrer");
						}}
					>
						<div className="relative">
							<MapIcon className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Documentation Button */}
				<Hint label="Documentation" side="bottom">
					<Button
						variant="ghost"
						size="iconSm"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open documentation in a new tab
							const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL!;
							window.open(docsUrl, "_blank", "noopener,noreferrer");
						}}
					>
						<div className="relative">
							<HelpCircle className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Chat Support Button */}
				<Hint label="Chat Support" side="bottom">
					<Button
						variant="ghost"
						size="iconSm"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Show Tidio chat widget
							showTidioChat();
						}}
					>
						<div className="relative">
							<HeartPulse className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Status Page Button */}
				<Hint label="System Status" side="bottom">
					<Button
						variant="ghost"
						size="iconSm"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open status page in a new tab
							const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_URL!;
							window.open(statusPageUrl, "_blank", "noopener,noreferrer");
						}}
					>
						<div className="relative">
							<Activity className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Notifications Button */}
				<Hint label="Notifications" side="bottom">
					<Button
						variant="ghost"
						size="iconSm"
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => setNotificationsOpen(true)}
					>
						<div className="relative">
							<Bell className="size-5" />
							{!isLoadingMentions && counts && counts.total > 0 && (
								<Badge
									variant="default"
									className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 border border-white shadow-sm"
								>
									{counts.total}
								</Badge>
							)}
						</div>
					</Button>
				</Hint>

				{/* Notification Dialog */}
				<MentionsNotificationDialog
					open={notificationsOpen}
					onOpenChange={setNotificationsOpen}
				/>

				<ThemeToggle />

				<UserButton
					forceOpenSettings={forceOpenUserSettings}
					defaultTab={userSettingsTab}
					onSettingsClose={handleUserSettingsClose}
				/>
			</div>
		</nav>
	);
};
