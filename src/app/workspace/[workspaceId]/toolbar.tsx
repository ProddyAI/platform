"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	Bell,
	Calendar,
	CheckSquare,
	FileText,
	HeartPulse,
	HelpCircle,
	LayoutList,
	Loader2,
	Map as MapIcon,
	MessageSquare,
	Search,
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

	const { data: workspace } = useGetWorkspace({ id: workspaceId });
	const { data: channels } = useGetChannels({ workspaceId });
	const { data: members } = useGetMembers({ workspaceId });
	const { counts, isLoading: isLoadingMentions } = useGetUnreadMentionsCount();

	const { results: searchResults, isLoading: isSearching } = useSearchMessages({
		workspaceId,
		query: searchQuery,
		enabled: searchQuery.trim().length > 0,
	});

	useEffect(() => {
		if (!searchOpen) return;
		const messageCount = searchResults.messages?.length ?? 0;
		const noteCount = searchResults.notes?.length ?? 0;
		const taskCount = searchResults.tasks?.length ?? 0;
		const cardCount = searchResults.cards?.length ?? 0;
		const eventCount = searchResults.events?.length ?? 0;
		console.log("[WorkspaceToolbar] search state", {
			searchOpen,
			searchQuery,
			isSearching,
			counts: {
				messages: messageCount,
				notes: noteCount,
				tasks: taskCount,
				cards: cardCount,
				events: eventCount,
			},
		});
	}, [searchOpen, searchQuery, isSearching, searchResults]);

	// Reset search state when dialog closes
	useEffect(() => {
		if (!searchOpen) {
			setSearchQuery("");
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
			<div className="flex items-center px-6">{children}</div>

			{/* Middle section - Search */}
			<div className="min-w-[280px] max-w-[642px] shrink grow-[2] px-4">
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
					<CommandInput
						onValueChange={setSearchQuery}
						placeholder={`Search ${workspace?.name ?? "workspace"}...`}
						value={searchQuery}
					/>
					<CommandList>
						{/* Loading state */}
						{isSearching && (
							<CommandEmpty>
								<div className="flex items-center justify-center gap-2 py-6">
									<Loader2 className="size-4 animate-spin" />
									<span>Searching...</span>
								</div>
							</CommandEmpty>
						)}

						{/* Search Results - Messages */}
						{searchQuery &&
							searchResults.messages?.length > 0 &&
							!isSearching && (
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

						{/* Normal Search Results - Notes */}
						{searchQuery && searchResults.notes?.length > 0 && !isSearching && (
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

						{/* Search Results - Tasks */}
						{searchQuery && searchResults.tasks?.length > 0 && !isSearching && (
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

						{/* Search Results - Cards */}
						{searchQuery && searchResults.cards?.length > 0 && !isSearching && (
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

						{/* Search Results - Calendar Events */}
						{searchQuery &&
							searchResults.events?.length > 0 &&
							!isSearching && (
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

						{/* Empty state for search */}
						{searchQuery &&
							searchResults.messages?.length === 0 &&
							searchResults.notes?.length === 0 &&
							searchResults.tasks?.length === 0 &&
							searchResults.cards?.length === 0 &&
							searchResults.events?.length === 0 &&
							!isSearching && <CommandEmpty>No results found.</CommandEmpty>}

						{/* Default state - show channels and members */}
						{!searchQuery && (
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
			<div className="ml-auto flex flex-1 items-center justify-end gap-x-3 px-6">
				{/* Roadmap Button */}
				<Hint label="Roadmap & Feedback" side="bottom">
					<Button
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open roadmap page in a new tab
							const roadmapUrl = process.env.NEXT_PUBLIC_ROADMAP_URL!;
							window.open(roadmapUrl, "_blank", "noopener,noreferrer");
						}}
						size="iconSm"
						variant="ghost"
					>
						<div className="relative">
							<MapIcon className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Documentation Button */}
				<Hint label="Documentation" side="bottom">
					<Button
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open documentation in a new tab
							const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL!;
							window.open(docsUrl, "_blank", "noopener,noreferrer");
						}}
						size="iconSm"
						variant="ghost"
					>
						<div className="relative">
							<HelpCircle className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Chat Support Button */}
				<Hint label="Chat Support" side="bottom">
					<Button
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Show Tidio chat widget
							showTidioChat();
						}}
						size="iconSm"
						variant="ghost"
					>
						<div className="relative">
							<HeartPulse className="size-5" />
						</div>
					</Button>
				</Hint>

				{/* Status Page Button */}
				<Hint label="System Status" side="bottom">
					<Button
						className="text-white relative hover:bg-white/15 transition-colors"
						onClick={() => {
							// Open status page in a new tab
							const statusPageUrl = process.env.NEXT_PUBLIC_STATUS_URL!;
							window.open(statusPageUrl, "_blank", "noopener,noreferrer");
						}}
						size="iconSm"
						variant="ghost"
					>
						<div className="relative">
							<Activity className="size-5" />
						</div>
					</Button>
				</Hint>

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
									className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center bg-red-500 border border-white shadow-sm"
									variant="default"
								>
									{counts.total}
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

				<UserButton
					defaultTab={userSettingsTab}
					forceOpenSettings={forceOpenUserSettings}
					onSettingsClose={handleUserSettingsClose}
				/>
			</div>
		</nav>
	);
};
