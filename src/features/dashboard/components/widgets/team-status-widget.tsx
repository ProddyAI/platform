"use client";

import { Loader, MessageSquare, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { PresenceIndicator } from "@/features/presence/components/presence-indicator";
import { useMultipleUserStatuses } from "@/features/presence/hooks/use-user-status";
import { useWorkspacePresence } from "@/features/presence/hooks/use-workspace-presence";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";

interface TeamStatusWidgetProps {
	workspaceId: Id<"workspaces">;
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const TeamStatusWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: TeamStatusWidgetProps) => {
	const router = useRouter();
	const { data: members, isLoading: membersLoading } = useGetMembers({
		workspaceId,
	});
	const { presenceState, onlineCount } = useWorkspacePresence({ workspaceId });

	// Get user IDs for status tracking
	const userIds = useMemo(
		() => (members ? members.map((m) => m.userId) : []),
		[members]
	);

	// Get statuses for all team members
	const { getUserStatus } = useMultipleUserStatuses(userIds, workspaceId);

	// Combine member data with presence data
	const teamMembers = useMemo(() => {
		if (!members) return [];

		// Create a map of online users for quick lookup
		const onlineUsers = new Set(
			presenceState.filter((p) => p.online).map((p) => p.userId)
		);

		// Real last-disconnect time from live presence, keyed by user. 0 means
		// "currently online" (see @convex-dev/presence), so only a positive
		// value is a genuine last-seen timestamp.
		const lastDisconnectedByUser = new Map(
			presenceState.map((p) => [p.userId, p.lastDisconnected])
		);

		return members
			.map((member) => {
				const isOnline = onlineUsers.has(member.userId);
				const status = getUserStatus(member.userId);
				const lastDisconnected = lastDisconnectedByUser.get(member.userId);

				return {
					...member,
					status,
					isOnline,
					lastActive:
						lastDisconnected && lastDisconnected > 0 ? lastDisconnected : null,
					// Ensure user object exists
					user: member?.user || { name: "Unknown User", image: "" },
				};
			})
			.sort((a, b) => {
				// Sort by online status first, then by name
				if (a.isOnline !== b.isOnline) {
					return a.isOnline ? -1 : 1;
				}

				return (a.user?.name ?? "").localeCompare(b.user?.name ?? "");
			});
	}, [members, presenceState, getUserStatus]);

	const handleStartChat = (userId: string) => {
		router.push(`/workspace/${workspaceId}/direct/${userId}`);
	};

	if (membersLoading) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<WidgetHeader
				badge={onlineCount > 0 ? `${onlineCount} online` : undefined}
				className="pr-2"
				controls={controls}
				icon={<Users className="size-5 text-primary" />}
				isEditMode={isEditMode}
				title="Team Status"
			/>

			{teamMembers.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{teamMembers.map((teamMember) => (
							<WidgetCard key={teamMember._id}>
								<div className="flex items-start gap-3">
									<div className="relative">
										<Avatar className="size-8">
											<AvatarImage
												alt={teamMember.user?.name ?? "User avatar"}
												src={teamMember.user?.image}
											/>
											<AvatarFallback>
												{teamMember.user?.name
													? teamMember.user.name.charAt(0).toUpperCase()
													: "U"}
											</AvatarFallback>
										</Avatar>
										<PresenceIndicator status={teamMember.status} />
									</div>
									<div className="flex-1 space-y-1">
										<div className="flex items-center justify-between">
											<div className="flex items-center gap-2">
												<p className="font-medium">
													{teamMember.user?.name ?? "Unknown User"}
												</p>
												<Badge className="border-2 text-xs" variant="outline">
													{teamMember.role}
												</Badge>
											</div>
											<RelativeTime
												fallback={
													teamMember.isOnline ? "Online now" : "Offline"
												}
												prefix="Last seen "
												timestamp={
													teamMember.isOnline ? null : teamMember.lastActive
												}
											/>
										</div>
										<Button
											className="mt-2 h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
											onClick={() => handleStartChat(teamMember.userId)}
											size="sm"
											variant="ghost"
										>
											<MessageSquare className="mr-2 size-3.5" />
											Message
										</Button>
									</div>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<WidgetEmptyState
					description="Invite members to see their status here"
					icon={Users}
					title="No team members"
				/>
			)}
		</div>
	);
};
