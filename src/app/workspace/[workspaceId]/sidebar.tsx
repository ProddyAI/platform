"use client";

import {
	AlertTriangle,
	BarChart,
	Bot,
	CalendarIcon,
	CheckSquare,
	ChevronDown,
	Hash,
	LayoutDashboard,
	Loader,
	MessageSquareText,
	PanelLeftClose,
	PanelLeftOpen,
	PlusIcon,
	SendHorizonal,
	Settings,
	Users,
} from "lucide-react";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Hint } from "@/components/hint";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { useCreateChannelModal } from "@/features/channels/store/use-create-channel-modal";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useGetWorkspace } from "@/features/workspaces/api/use-get-workspace";
import { useChannelId } from "@/hooks/use-channel-id";
import { useMemberId } from "@/hooks/use-member-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

import { WorkspaceHeader } from "./header";
import { ChannelItem, MemberItem, SidebarItem } from "./options";

interface MobileCloseWrapperProps {
	children: React.ReactNode;
	onClose?: () => void;
	className?: string;
	ariaLabel?: string;
}

const MobileCloseWrapper = ({
	children,
	onClose,
	className,
	ariaLabel = "Close mobile sidebar",
}: MobileCloseWrapperProps) => {
	const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
		if (!onClose) {
			return;
		}

		if (event.key === "Enter" || event.key === " ") {
			event.preventDefault();
			onClose();
		}
	};

	return (
		<div
			aria-label={onClose ? ariaLabel : undefined}
			className={className}
			onClick={onClose}
			onKeyDown={onClose ? handleKeyDown : undefined}
			role={onClose ? "button" : undefined}
			tabIndex={onClose ? 0 : undefined}
		>
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
			<div
				className="group flex w-full cursor-pointer items-center gap-x-2 md:gap-x-3 rounded-[10px] px-2 md:px-4 py-2.5 text-sm font-medium transition-standard text-secondary-foreground/80 hover:bg-secondary-foreground/10"
				onClick={handleToggle}
			>
				{isCollapsed ? (
					<div className="relative flex-shrink-0">
						<Hint align="center" label={label} side="right">
							<Icon className="size-4 md:size-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
						</Hint>
					</div>
				) : (
					<Icon className="size-4 md:size-5 flex-shrink-0 transition-transform duration-200 group-hover:scale-110" />
				)}

				{!isCollapsed && (
					<>
						<span className="truncate min-w-0">{label}</span>
						<ChevronDown
							className={cn(
								"ml-auto size-4 flex-shrink-0 transition-transform duration-200",
								!isExpanded && "-rotate-90"
							)}
						/>

						{onNew && (
							<Hint align="center" label={hint} side="top">
								<Button
									className="h-7 w-7 flex-shrink-0 p-0 text-secondary-foreground/80 opacity-0 transition-all group-hover:opacity-100 rounded-[8px] hover:bg-secondary-foreground/10"
									onClick={(e) => {
										e.stopPropagation();
										onNew();
									}}
									size="sm"
									variant="ghost"
								>
									<PlusIcon className="size-4 transition-transform duration-200 hover:scale-110" />
								</Button>
							</Hint>
						)}
					</>
				)}
			</div>

			{isExpanded && (
				<div className="mt-2 space-y-1.5 pl-1 md:pl-2">{children}</div>
			)}
		</div>
	);
};

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
	const memberId = useMemberId();
	const pathname = usePathname();
	// Track which sections are expanded
	const [expandedSections, setExpandedSections] = useState<
		Record<string, boolean>
	>({
		Channels: true, // Channels expanded by default
		Members: false, // Members collapsed by default
		Planning: false,
		Messages: false,
		Settings: false,
	});

	const [_open, setOpen] = useCreateChannelModal();

	const handleSectionToggle = (label: string) => {
		// If we're expanding a section, collapse all others
		if (!expandedSections[label]) {
			const newExpandedSections: Record<string, boolean> = {};

			// Set all sections to collapsed
			Object.keys(expandedSections).forEach((section) => {
				newExpandedSections[section] = false;
			});

			// Expand only the clicked section
			newExpandedSections[label] = true;

			setExpandedSections(newExpandedSections);
		} else {
			// If we're collapsing a section, just toggle it
			setExpandedSections({
				...expandedSections,
				[label]: !expandedSections[label],
			});
		}
	};

	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});
	const { data: workspace, isLoading: workspaceLoading } = useGetWorkspace({
		id: workspaceId,
	});
	const { data: channels, isLoading: channelsLoading } = useGetChannels({
		workspaceId,
	});
	const { data: members, isLoading: membersLoading } = useGetMembers({
		workspaceId,
	});

	if (memberLoading || workspaceLoading || channelsLoading || membersLoading) {
		return (
			<div className="flex h-full flex-col items-center justify-center bg-primary">
				<Loader className="size-6 animate-spin text-secondary-foreground animate-pulse-subtle" />
			</div>
		);
	}

	if (!workspace || !member) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-y-3 bg-primary">
				<AlertTriangle className="size-6 text-secondary-foreground animate-pulse-subtle" />
				<p className="text-sm font-medium text-secondary-foreground animate-fade-in">
					Workspace not found.
				</p>
			</div>
		);
	}

	return (
		<div
			className={cn(
				"flex h-full flex-col bg-primary transition-all duration-300 ease-in-out border-r-2 border-white/20 dark:border-border/40",
				isCollapsed ? "w-[70px]" : "w-[280px]"
			)}
		>
			{/* Close button for mobile overlay */}
			{onMobileClose && (
				<div className="flex justify-end p-2 md:hidden flex-shrink-0">
					<Button
						className="h-8 w-8 rounded-full p-0"
						onClick={onMobileClose}
						size="sm"
						variant="ghost"
					>
						<PanelLeftClose className="size-4 text-secondary-foreground/80" />
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
					"flex-1 overflow-y-auto overflow-x-hidden sidebar-scrollbar",
					onMobileClose && "pb-4"
				)}
			>
				{/* Dashboard Link - Hidden in footer on mobile, shown in overlay */}
				<div
					className={cn(
						"mt-4 px-2 md:px-4",
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
				{channels && channels.length > 0 && (
					<div className="mt-2">
						<DroppableItem
							hint="Channels"
							icon={Hash}
							isCollapsed={isCollapsed}
							isExpanded={expandedSections.Channels}
							label="Channels"
							onToggle={handleSectionToggle}
						>
							{channels.map((item) => (
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
								<div
									className={cn(
										"group flex items-center gap-2 md:gap-3 font-medium text-sm overflow-hidden rounded-[10px] transition-standard w-full text-secondary-foreground/80 hover:bg-secondary-foreground/10 hover:translate-x-1 cursor-pointer",
										isCollapsed
											? "justify-center px-1 md:px-2 py-2 md:py-2.5"
											: "justify-start px-2 md:px-4 py-2 md:py-2.5"
									)}
									onClick={() => setOpen(true)}
								>
									{isCollapsed ? (
										<div className="relative flex-shrink-0">
											<Hint align="center" label="New Channel" side="right">
												<div className="flex items-center justify-center">
													<PlusIcon className="size-4 text-secondary-foreground/80" />
												</div>
											</Hint>
										</div>
									) : (
										<>
											<PlusIcon className="size-4 text-secondary-foreground/80" />
											<span className="truncate min-w-0">New Channel</span>
										</>
									)}
								</div>
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
						</DroppableItem>
					</div>
				)}

				{/* Divider between dynamic and static sections */}
				<Separator className="my-4 mx-4 bg-secondary-foreground/10" />

				{/* Planning Section */}
				<div className="mt-2">
					<DroppableItem
						hint="Planning"
						icon={CalendarIcon}
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
							<SidebarItem
								href={`/workspace/${workspaceId}/manage`}
								icon={Settings}
								id="manage"
								isActive={pathname.includes("/manage")}
								isCollapsed={isCollapsed}
								label="Manage"
							/>
						</MobileCloseWrapper>
					</DroppableItem>
				</div>
			</div>

			{/* Collapse/Expand Button - Hidden in mobile overlay */}
			{!onMobileClose && (
				<div className="mt-auto mb-4 flex justify-center">
					<Hint
						label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
						side="right"
					>
						<Button
							className="h-8 w-8 rounded-full p-0 flex items-center justify-center hover:bg-secondary-foreground/10"
							onClick={() => setIsCollapsed(!isCollapsed)}
							size="sm"
							variant="ghost"
						>
							{isCollapsed ? (
								<PanelLeftOpen className="size-4 text-secondary-foreground/80" />
							) : (
								<PanelLeftClose className="size-4 text-secondary-foreground/80" />
							)}
						</Button>
					</Hint>
				</div>
			)}
		</div>
	);
};
