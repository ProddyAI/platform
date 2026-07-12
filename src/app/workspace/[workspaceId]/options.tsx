"use client";

import type { LucideIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import type { Id } from "@/../convex/_generated/dataModel";
import type { UserStatus } from "@/../convex/workspace/userStatus";
import { Hint } from "@/components/hint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PresenceIndicator } from "@/features/presence/components/presence-indicator";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { generateUserColor } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";

// SidebarItem Component
interface SidebarItemProps {
	label: string;
	icon: LucideIcon;
	id: string;
	href?: string;
	isActive?: boolean;
	isCollapsed?: boolean;
}

export const SidebarItem = ({
	label,
	icon: Icon,
	id,
	href,
	isActive,
	isCollapsed = false,
}: SidebarItemProps) => {
	const workspaceId = useWorkspaceId();

	const content = (
		<div
			className={cn(
				"group flex w-full cursor-pointer items-center gap-x-2 md:gap-x-3 rounded-full px-2 md:px-4 py-2 md:py-2.5 text-sm font-medium transition-standard",
				isActive
					? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
					: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
				isCollapsed && "mx-auto size-9 justify-center px-0 md:px-0"
			)}
		>
			{isCollapsed ? (
				<div className="relative flex-shrink-0">
					<Hint align="center" label={label} side="right">
						<Icon className="size-4 md:size-5 flex-shrink-0" />
					</Hint>
				</div>
			) : (
				<>
					<Icon className="size-4 md:size-5 flex-shrink-0" />
					<span className="truncate min-w-0">{label}</span>
				</>
			)}
		</div>
	);

	if (href) {
		return <Link href={href}>{content}</Link>;
	}

	// For channels, use the channel ID
	if (id.startsWith("channels/")) {
		const channelId = id.replace("channels/", "");
		return (
			<Link href={`/workspace/${workspaceId}/channel/${channelId}/chats`}>
				{content}
			</Link>
		);
	}

	return content;
};

// MemberItem Component
interface MemberItemProps {
	id: Id<"members">;
	userId: Id<"users">;
	label?: string;
	image?: string;
	status?: UserStatus;
	isActive?: boolean;
	isCollapsed?: boolean;
}

export const MemberItem = ({
	id,
	userId,
	label = "Member",
	image,
	status = "offline",
	isActive = false,
	isCollapsed = false,
}: MemberItemProps) => {
	const workspaceId = useWorkspaceId();
	const avatarFallback = label.charAt(0).toUpperCase();

	// Generate background color for avatar fallback
	const backgroundColor = generateUserColor(userId);

	return (
		<Button
			asChild
			className={cn(
				"group py-2 md:py-2.5 flex items-center gap-2 md:gap-3 font-medium h-9 md:h-10 text-sm overflow-hidden rounded-full transition-standard w-full",
				isActive
					? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
					: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
				isCollapsed
					? "mx-auto size-9 justify-center px-0"
					: "justify-start px-2 md:px-4"
			)}
			size="sm"
			variant="ghost"
		>
			<Link
				className="w-full overflow-hidden"
				href={`/workspace/${workspaceId}/member/${id}`}
			>
				{isCollapsed ? (
					<div className="relative flex-shrink-0">
						<Hint align="center" label={label} side="right">
							<div className="relative">
								<Avatar className="size-6 md:size-7">
									<AvatarImage alt={label} src={image} />
									<AvatarFallback
										className="text-xs font-medium text-white"
										style={{ backgroundColor }}
									>
										{avatarFallback}
									</AvatarFallback>
								</Avatar>
								<PresenceIndicator
									className="size-2 md:w-2.5 md:h-2.5"
									status={status}
								/>
							</div>
						</Hint>
					</div>
				) : (
					<>
						<div className="relative mr-2 md:mr-3 flex-shrink-0">
							<Avatar className="size-6 md:size-7">
								<AvatarImage alt={label} src={image} />
								<AvatarFallback
									className="text-xs font-medium text-white"
									style={{ backgroundColor }}
								>
									{avatarFallback}
								</AvatarFallback>
							</Avatar>
							<PresenceIndicator
								className="size-2 md:w-2.5 md:h-2.5"
								status={status}
							/>
						</div>
						<span className="truncate min-w-0 text-sm flex-1">{label}</span>
					</>
				)}
			</Link>
		</Button>
	);
};

// ChannelItem Component
interface ChannelItemProps {
	id: Id<"channels">;
	label: string;
	icon?: string;
	iconImageUrl?: string | null;
	isActive?: boolean;
	isCollapsed?: boolean;
}

export const ChannelItem = ({
	id,
	label,
	icon,
	iconImageUrl,
	isActive = false,
	isCollapsed = false,
}: ChannelItemProps) => {
	const workspaceId = useWorkspaceId();
	const channelFallback = label.charAt(0).toLowerCase();
	const [imageLoadError, setImageLoadError] = useState(false);

	// Determine what to display in the icon area
	const renderIcon = () => {
		if (iconImageUrl && !imageLoadError) {
			return (
				<Image
					alt={`Channel icon for ${label}`}
					className="size-full rounded-full object-cover"
					height={28}
					onError={() => setImageLoadError(true)}
					src={iconImageUrl}
					width={28}
				/>
			);
		}
		if (icon) {
			return <span className="text-base">{icon}</span>;
		}
		return (
			<span className="text-xs font-medium text-muted-foreground">
				{channelFallback}
			</span>
		);
	};

	return (
		<Link
			className="w-full"
			href={`/workspace/${workspaceId}/channel/${id}/chats`}
		>
			<div
				className={cn(
					"group flex w-full cursor-pointer items-center gap-x-2 md:gap-x-3 rounded-full px-2 md:px-4 py-2 md:py-2.5 text-sm font-medium transition-standard",
					isActive
						? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
						: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
					isCollapsed && "mx-auto size-9 justify-center px-0"
				)}
			>
				{isCollapsed ? (
					<div className="relative flex-shrink-0">
						<Hint align="center" label={label} side="right">
							<div className="flex h-6 md:h-7 w-6 md:w-7 items-center justify-center rounded-full bg-muted overflow-hidden">
								{renderIcon()}
							</div>
						</Hint>
					</div>
				) : (
					<>
						<div className="flex h-6 md:h-7 w-6 md:w-7 items-center justify-center rounded-full bg-muted overflow-hidden mr-2 md:mr-3 flex-shrink-0">
							{renderIcon()}
						</div>
						<span className="truncate min-w-0">{label}</span>
					</>
				)}
			</div>
		</Link>
	);
};

// ProjectItem Component
interface ProjectItemProps {
	id: Id<"projects">;
	label: string;
	icon?: string;
	iconImageUrl?: string | null;
	isActive?: boolean;
	isCollapsed?: boolean;
}

export const ProjectItem = ({
	id,
	label,
	icon,
	iconImageUrl,
	isActive = false,
	isCollapsed = false,
}: ProjectItemProps) => {
	const workspaceId = useWorkspaceId();
	const projectFallback = label.charAt(0).toLowerCase();
	const [imageLoadError, setImageLoadError] = useState(false);

	const renderIcon = () => {
		if (iconImageUrl && !imageLoadError) {
			return (
				<Image
					alt={`Project icon for ${label}`}
					className="size-full rounded-full object-cover"
					height={28}
					onError={() => setImageLoadError(true)}
					src={iconImageUrl}
					width={28}
				/>
			);
		}
		if (icon) {
			return <span className="text-base">{icon}</span>;
		}
		return (
			<span className="text-xs font-medium text-muted-foreground">
				{projectFallback}
			</span>
		);
	};

	return (
		<Link
			className="w-full"
			href={`/workspace/${workspaceId}/project/${id}/board`}
		>
			<div
				className={cn(
					"group flex w-full cursor-pointer items-center gap-x-2 md:gap-x-3 rounded-full px-2 md:px-4 py-2 md:py-2.5 text-sm font-medium transition-standard",
					isActive
						? "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90"
						: "text-sidebar-foreground hover:bg-sidebar-accent hover:text-foreground",
					isCollapsed && "mx-auto size-9 justify-center px-0"
				)}
			>
				{isCollapsed ? (
					<div className="relative flex-shrink-0">
						<Hint align="center" label={label} side="right">
							<div className="flex h-6 md:h-7 w-6 md:w-7 items-center justify-center rounded-full bg-muted overflow-hidden">
								{renderIcon()}
							</div>
						</Hint>
					</div>
				) : (
					<>
						<div className="flex h-6 md:h-7 w-6 md:w-7 items-center justify-center rounded-full bg-muted overflow-hidden mr-2 md:mr-3 flex-shrink-0">
							{renderIcon()}
						</div>
						<span className="truncate min-w-0">{label}</span>
					</>
				)}
			</div>
		</Link>
	);
};
