"use client";

import {
	Activity,
	AlertTriangle,
	BarChart,
	Bot,
	Brain,
	CalendarIcon,
	ChartNoAxesGantt,
	CheckSquare,
	ChevronDown,
	FolderKanban,
	Hash,
	LayoutDashboard,
	Loader,
	MessageSquareText,
	PanelLeftClose,
	PanelLeftOpen,
	PlusIcon,
	SendHorizonal,
	Settings,
	SlidersHorizontal,
	Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { UserButton } from "@/features/auth/components/user-button";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useCreateChannelModal } from "@/features/channels/store/use-create-channel-modal";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useInviteMemberModal } from "@/features/members/store/use-invite-member-modal";
import { useGetProjects } from "@/features/projects/api/use-get-projects";
import { useCreateProjectModal } from "@/features/projects/store/use-create-project-modal";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useChannelId } from "@/hooks/use-channel-id";
import { useMemberId } from "@/hooks/use-member-id";
import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import { WorkspaceHeader } from "./header";
import { ChannelItem, MemberItem, ProjectItem, SidebarItem } from "./options";

// Remembers which sidebar sections the user last left open/closed.
const SIDEBAR_SECTIONS_STORAGE_KEY = "proddy:sidebar-expanded-sections";

interface MobileCloseWrapperProps {
	children: React.ReactNode;
	onClose?: () => void;
	className?: string;
}

const MobileCloseWrapper = ({
	children,
	onClose,
	className,
}: MobileCloseWrapperProps) => {
	if (!onClose) {
		return <div className={className}>{children}</div>;
	}

	// The children are already focusable, keyboard-operable controls (links,
	// buttons). Wrapping them in another <button> would nest interactive
	// controls inside one another, which is invalid HTML and breaks
	// assistive tech. Instead, let the click bubble up from the child (fired
	// by mouse or by native Enter-key activation of a link) to close the
	// mobile sidebar.
	return (
		// biome-ignore lint/a11y/useKeyWithClickEvents: keyboard activation is handled by the nested link/button (its own Enter-key click bubbles here); giving this wrapper its own interactive role would duplicate the focus stop.
		<div className={className} onClick={onClose}>
			{children}
		</div>
	);
};

// DroppableItem Component
interface DroppableItemProps {
	label: string;
	hint: string;
	icon: React.ElementType;
	onNew?: () => void;
	children: React.ReactNode;
	isCollapsed?: boolean;
	isExpanded: boolean;
	onToggle: (label: string) => void;
}

const DroppableItem = ({
	children,
	hint,
	label,
	icon: Icon,
	onNew,
	isCollapsed = false,
	isExpanded,
	onToggle,
}: DroppableItemProps) => {
	const handleToggle = () => {
		onToggle(label);
	};

	return (
		<div
			className={cn(
				"flex flex-col w-full",
				isCollapsed ? "px-1" : "px-2 md:px-4"
			)}
		>
			{/* Toggle and "new" action are sibling controls, not nested —
			    a button inside a button is invalid HTML and unreliable for
			    screen readers and keyboard focus order. Geometry (radius,
			    padding, height) mirrors SidebarItem so headers and their
			    sub-items read as one consistent list. */}
			<div className="group flex w-full items-center gap-x-2 md:gap-x-3 rounded-full px-2 md:px-4 py-2 md:py-2.5 transition-standard text-muted-foreground hover:bg-sidebar-accent">
				<button
					className="flex flex-1 min-w-0 cursor-pointer items-center gap-x-2 md:gap-x-3 text-left"
					onClick={handleToggle}
					type="button"
				>
					{isCollapsed ? (
						<div className="relative flex-shrink-0">
							<Hint align="center" label={label} side="right">
								<Icon className="size-4 md:size-5 flex-shrink-0 text-muted-foreground/60" />
							</Hint>
						</div>
					) : (
						<Icon className="size-4 md:size-5 flex-shrink-0 text-muted-foreground/60" />
					)}

					{!isCollapsed && (
						<>
							<span className="truncate min-w-0 text-[11px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
								{label}
							</span>
							<ChevronDown
								className={cn(
									"ml-auto size-4 flex-shrink-0 text-muted-foreground/70 transition-transform duration-200",
									!isExpanded && "-rotate-90"
								)}
							/>
						</>
					)}
				</button>

				{!isCollapsed && onNew && (
					<Hint align="center" label={hint} side="top">
						<Button
							className="size-7 flex-shrink-0 p-0 text-muted-foreground opacity-0 transition-all group-hover:opacity-100 rounded-md hover:bg-sidebar-accent"
							onClick={onNew}
							size="sm"
							variant="ghost"
						>
							<PlusIcon className="size-4" />
						</Button>
					</Hint>
				)}
			</div>

			{isExpanded && (
				<div
					className={cn(
						"mt-1 space-y-1",
						// Indent sub-item pills to the right of the section header so
						// the header reads as the parent. Only when expanded — the
						// collapsed rail centers its icons and must not be offset.
						!isCollapsed && "pl-2 md:pl-3"
					)}
				>
					{children}
				</div>
			)}
		</div>
	);
};

// NewItemButton Component — shared "+ New X" trigger used by the
// Channels/Projects/Members sections below.
interface NewItemButtonProps {
	label: string;
	isCollapsed?: boolean;
	onClick: () => void;
}

const NewItemButton = ({
	label,
	isCollapsed = false,
	onClick,
}: NewItemButtonProps) => (
	<button
		className={cn(
			"group flex items-center gap-2 md:gap-3 font-medium text-sm overflow-hidden rounded-full transition-standard w-full text-muted-foreground hover:bg-sidebar-accent hover:text-foreground cursor-pointer",
			isCollapsed
				? "justify-center px-1 md:px-2 py-2 md:py-2.5"
				: "justify-start px-2 md:px-4 py-2 md:py-2.5"
		)}
		onClick={onClick}
		type="button"
	>
		{isCollapsed ? (
			<div className="relative flex-shrink-0">
				<Hint align="center" label={label} side="right">
					<div className="flex items-center justify-center">
						<PlusIcon className="size-4 text-muted-foreground" />
					</div>
				</Hint>
			</div>
		) : (
			<>
				<PlusIcon className="size-4 text-muted-foreground" />
				<span className="truncate min-w-0">{label}</span>
			</>
		)}
	</button>
);

// WorkspaceSidebar Component
export const WorkspaceSidebar = ({
	isCollapsed,
	setIsCollapsed,
	onMobileClose,
}: {
	isCollapsed: boolean;
	setIsCollapsed: (value: boolean) => void;
	onMobileClose?: () => void;
}) => {
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const projectId = useProjectId();
	const memberId = useMemberId();
	const pathname = usePathname();
	// Track which sections are expanded. Sections toggle independently and
	// start collapsed; the user's last-open sections are rehydrated from
	// localStorage in the effect below.
	const [expandedSections, setExpandedSections] = useState<
		Record<string, boolean>
	>(() => ({
		Channels: false,
		Projects: false,
		Members: false,
		Planning: false,
		Messages: false,
		Settings: false,
	}));

	// Rehydrate the user's last expanded/collapsed sections from a previous
	// visit. Reads happen in an effect (not the state initializer) so the
	// server-rendered and first client render agree, avoiding a hydration
	// mismatch. Everything starts collapsed unless the user previously
	// expanded it.
	// biome-ignore lint/correctness/useExhaustiveDependencies: intentionally rehydrates once on mount only.
	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		try {
			const raw = window.localStorage.getItem(SIDEBAR_SECTIONS_STORAGE_KEY);
			if (!raw) {
				return;
			}
			const persisted = JSON.parse(raw) as Record<string, boolean>;
			setExpandedSections((prev) => ({
				...prev,
				...persisted,
			}));
		} catch {
			// Ignore malformed storage; fall back to the collapsed defaults.
		}
	}, []);

	useEffect(() => {
		if (typeof window === "undefined") {
			return;
		}
		window.localStorage.setItem(
			SIDEBAR_SECTIONS_STORAGE_KEY,
			JSON.stringify(expandedSections)
		);
	}, [expandedSections]);

	const [_open, setOpen] = useCreateChannelModal();
	const [_createProjectOpen, setCreateProjectOpen] = useCreateProjectModal();
	const [_inviteOpen, setInviteOpen] = useInviteMemberModal();

	const handleSectionToggle = (label: string) => {
		setExpandedSections((prev) => ({
			...prev,
			[label]: !prev[label],
		}));
	};

	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
		id: workspaceId as Id<"workspaces">,
	});
	const { data: channels, isLoading: channelsLoading } = useGetChannels({
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const { data: projects, isLoading: projectsLoading } = useGetProjects({
		workspaceId: workspaceId as Id<"workspaces">,
	});
	const { data: members, isLoading: membersLoading } = useGetMembers({
		workspaceId: workspaceId as Id<"workspaces">,
	});

	if (
		memberLoading ||
		workspaceLoading ||
		channelsLoading ||
		projectsLoading ||
		membersLoading
	) {
		return (
			<div className="flex h-full flex-col items-center justify-center bg-sidebar">
				<Loader className="size-6 animate-spin text-muted-foreground animate-pulse-subtle" />
			</div>
		);
	}

	if (!workspace || !member) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-y-3 bg-sidebar">
				<AlertTriangle className="size-6 text-muted-foreground animate-pulse-subtle" />
				<p className="text-sm font-medium text-muted-foreground animate-fade-in">
					Workspace not found.
				</p>
			</div>
		);
	}

	const chatChannels = (channels || []).filter((item) => item.type !== "board");

	return (
		<div
			className={cn(
				"flex h-full w-full flex-col bg-sidebar border-r border-sidebar-border",
				// Width is owned by the parent container (fixed 70px when collapsed,
				// adjustable when expanded); fill it here.
				isCollapsed && "min-w-[70px]"
			)}
		>
			{/* Close button for mobile overlay */}
			{onMobileClose && (
				<div className="flex justify-end p-2 md:hidden flex-shrink-0">
					<Button
						className="size-8 rounded-full p-0"
						onClick={onMobileClose}
						size="sm"
						variant="ghost"
					>
						<PanelLeftClose className="size-4 text-muted-foreground" />
					</Button>
				</div>
			)}

			{/* Workspace Header */}
			<div className="flex-shrink-0">
				<WorkspaceHeader
					isAdmin={member.role === "admin"}
					isCollapsed={isCollapsed}
					workspace={workspace}
				/>
			</div>

			{/* Scrollable content container */}
			<div
				className={cn(
					"flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar py-3",
					onMobileClose && "pb-4"
				)}
			>
				{/* Dashboard Link - Hidden in footer on mobile, shown in overlay */}
				<div
					className={cn(
						"px-2 md:px-4",
						onMobileClose ? "block" : "hidden md:block"
					)}
				>
					<MobileCloseWrapper onClose={onMobileClose}>
						<SidebarItem
							href={`/workspace/${workspaceId}/dashboard`}
							icon={LayoutDashboard}
							id="dashboard"
							isActive={pathname.includes("/dashboard")}
							isCollapsed={isCollapsed}
							label="Dashboard"
						/>
					</MobileCloseWrapper>
				</div>

				{/* Proddy AI Link - Hidden in footer on mobile, shown in overlay */}
				<div
					className={cn(
						"mt-2 px-2 md:px-4",
						onMobileClose ? "block" : "hidden md:block"
					)}
				>
					<MobileCloseWrapper onClose={onMobileClose}>
						<SidebarItem
							href={`/workspace/${workspaceId}/assistant`}
							icon={Bot}
							id="assistant"
							isActive={pathname.includes("/assistant")}
							isCollapsed={isCollapsed}
							label="Proddy AI"
						/>
					</MobileCloseWrapper>
				</div>

				{/* Channels Section */}
				{chatChannels.length > 0 && (
					<div className="mt-2">
						<DroppableItem
							hint="Channels"
							icon={Hash}
							isCollapsed={isCollapsed}
							isExpanded={expandedSections.Channels}
							label="Channels"
							onToggle={handleSectionToggle}
						>
							{chatChannels.map((item) => (
								<MobileCloseWrapper key={item._id} onClose={onMobileClose}>
									<ChannelItem
										icon={item.icon}
										iconImageUrl={item.iconImageUrl}
										id={item._id}
										isActive={channelId === item._id}
										isCollapsed={isCollapsed}
										label={item.name}
									/>
								</MobileCloseWrapper>
							))}

							{/* New Channel option - only visible to admins and owners */}
							{(member.role === "admin" || member.role === "owner") && (
								<NewItemButton
									isCollapsed={isCollapsed}
									label="New Channel"
									onClick={() => setOpen(true)}
								/>
							)}
						</DroppableItem>
					</div>
				)}

				{/* Projects Section */}
				{projects && (
					<div className="mt-2">
						<DroppableItem
							hint="Projects"
							icon={FolderKanban}
							isCollapsed={isCollapsed}
							isExpanded={expandedSections.Projects}
							label="Projects"
							onToggle={handleSectionToggle}
						>
							{projects.map((project) => (
								<div key={project._id}>
									<MobileCloseWrapper onClose={onMobileClose}>
										<ProjectItem
											icon={project.connectedChannelIcon}
											iconImageUrl={project.connectedChannelIconImageUrl}
											id={project._id}
											isActive={
												projectId === project._id ||
												pathname.includes(`/project/${project._id}`)
											}
											isCollapsed={isCollapsed}
											label={project.name}
										/>
									</MobileCloseWrapper>
								</div>
							))}

							{(member.role === "admin" || member.role === "owner") && (
								<NewItemButton
									isCollapsed={isCollapsed}
									label="New Project"
									onClick={() => setCreateProjectOpen(true)}
								/>
							)}
						</DroppableItem>
					</div>
				)}

				{/* Members Section */}
				{members && members.length > 0 && (
					<div className="mt-2">
						<DroppableItem
							hint="Members"
							icon={Users}
							isCollapsed={isCollapsed}
							isExpanded={expandedSections.Members}
							label="Members"
							onToggle={handleSectionToggle}
						>
							{members.map((item) => (
								<MobileCloseWrapper key={item._id} onClose={onMobileClose}>
									<MemberItem
										id={item._id}
										image={item.user.image}
										isActive={item._id === memberId}
										isCollapsed={isCollapsed}
										label={item.user.name}
									/>
								</MobileCloseWrapper>
							))}

							{/* New Member option - only visible to admins and owners */}
							{(member.role === "admin" || member.role === "owner") && (
								<NewItemButton
									isCollapsed={isCollapsed}
									label="New Member"
									onClick={() => setInviteOpen(true)}
								/>
							)}
						</DroppableItem>
					</div>
				)}

				{/* Divider between dynamic and static sections */}
				<Separator className="my-4 mx-4 bg-sidebar-border" />

				{/* Planning Section */}
				<div className="mt-2">
					<DroppableItem
						hint="Planning"
						icon={ChartNoAxesGantt}
						isCollapsed={isCollapsed}
						isExpanded={expandedSections.Planning}
						label="Planning"
						onToggle={handleSectionToggle}
					>
						<MobileCloseWrapper onClose={onMobileClose}>
							<SidebarItem
								href={`/workspace/${workspaceId}/tasks`}
								icon={CheckSquare}
								id="tasks"
								isActive={pathname.includes("/tasks")}
								isCollapsed={isCollapsed}
								label="Tasks"
							/>
						</MobileCloseWrapper>
						<MobileCloseWrapper onClose={onMobileClose}>
							<SidebarItem
								href={`/workspace/${workspaceId}/meetings`}
								icon={Brain}
								id="meetings"
								isActive={pathname.includes("/meetings")}
								isCollapsed={isCollapsed}
								label="Meetings"
							/>
						</MobileCloseWrapper>
						<MobileCloseWrapper onClose={onMobileClose}>
							<SidebarItem
								href={`/workspace/${workspaceId}/calendar`}
								icon={CalendarIcon}
								id="calendar"
								isActive={pathname.includes("/calendar")}
								isCollapsed={isCollapsed}
								label="Calendar"
							/>
						</MobileCloseWrapper>
					</DroppableItem>
				</div>

				{/* Messages Section */}
				<div className="mt-2">
					<DroppableItem
						hint="Messages"
						icon={MessageSquareText}
						isCollapsed={isCollapsed}
						isExpanded={expandedSections.Messages}
						label="Messages"
						onToggle={handleSectionToggle}
					>
						{/* Outbox - Hidden on mobile (shown in footer) */}
						<MobileCloseWrapper
							className="hidden md:block"
							onClose={onMobileClose}
						>
							<SidebarItem
								href={`/workspace/${workspaceId}/outbox`}
								icon={SendHorizonal}
								id="outbox"
								isActive={pathname.includes("/outbox")}
								isCollapsed={isCollapsed}
								label="Outbox"
							/>
						</MobileCloseWrapper>
						{/* Threads - Hidden on mobile (shown in footer) */}
						<MobileCloseWrapper
							className="hidden md:block"
							onClose={onMobileClose}
						>
							<SidebarItem
								href={`/workspace/${workspaceId}/threads`}
								icon={MessageSquareText}
								id="threads"
								isActive={pathname.includes("/threads")}
								isCollapsed={isCollapsed}
								label="Threads"
							/>
						</MobileCloseWrapper>
					</DroppableItem>
				</div>

				{/* Settings Section */}
				<div className="mt-2">
					<DroppableItem
						hint="Settings"
						icon={Settings}
						isCollapsed={isCollapsed}
						isExpanded={expandedSections.Settings}
						label="Settings"
						onToggle={handleSectionToggle}
					>
						{(member.role === "admin" || member.role === "owner") && (
							<MobileCloseWrapper onClose={onMobileClose}>
								<SidebarItem
									href={`/workspace/${workspaceId}/reports`}
									icon={BarChart}
									id="reports"
									isActive={pathname.includes("/reports")}
									isCollapsed={isCollapsed}
									label="Reports"
								/>
							</MobileCloseWrapper>
						)}
						<MobileCloseWrapper onClose={onMobileClose}>
							{" "}
							<SidebarItem
								href={`/workspace/${workspaceId}/usage`}
								icon={Activity}
								id="usage"
								isActive={pathname.includes("/usage")}
								isCollapsed={isCollapsed}
								label="Usage"
							/>
						</MobileCloseWrapper>
						<MobileCloseWrapper onClose={onMobileClose}>
							<SidebarItem
								href={`/workspace/${workspaceId}/manage`}
								icon={SlidersHorizontal}
								id="manage"
								isActive={pathname.includes("/manage")}
								isCollapsed={isCollapsed}
								label="Manage"
							/>
						</MobileCloseWrapper>
					</DroppableItem>
				</div>
			</div>

			{/* Footer: account menu (bottom-left) + collapse toggle */}
			<div
				className={cn(
					"mt-auto flex-shrink-0 border-t border-sidebar-border",
					isCollapsed ? "px-1 py-3" : "px-3 py-3"
				)}
			>
				{/* Expanded: account and collapse toggle share one row (toggle on
				    the right). Collapsed: they stack, toggle centered below. */}
				<div
					className={cn(
						"flex",
						isCollapsed
							? "flex-col items-center gap-2"
							: "flex-row items-center gap-2"
					)}
				>
					<div className={cn(!isCollapsed && "min-w-0 flex-1")}>
						<UserButton isCollapsed={isCollapsed} variant="sidebar" />
					</div>

					{/* Collapse/Expand Button - Hidden in mobile overlay */}
					{!onMobileClose && (
						<Hint
							label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
							side="right"
						>
							<Button
								className="size-8 flex-shrink-0 rounded-full p-0 flex items-center justify-center hover:bg-sidebar-accent"
								onClick={() => setIsCollapsed(!isCollapsed)}
								size="sm"
								variant="ghost"
							>
								{isCollapsed ? (
									<PanelLeftOpen className="size-4 text-muted-foreground" />
								) : (
									<PanelLeftClose className="size-4 text-muted-foreground" />
								)}
							</Button>
						</Hint>
					)}
				</div>
			</div>
		</div>
	);
};
