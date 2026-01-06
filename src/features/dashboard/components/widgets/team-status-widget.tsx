"use client";

import { formatDistanceToNow } from "date-fns";
import {
	Circle,
	CircleCheck,
	Clock,
	Loader,
	MessageSquare,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetMembers } from "@/features/members/api/use-get-members";
import { useWorkspacePresence } from "@/features/presence/hooks/use-workspace-presence";

interface TeamStatusWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
}

export const TeamStatusWidget = ({
	workspaceId,
	isEditMode,
}: TeamStatusWidgetProps) => {
	const router = useRouter();
	const { data: members, isLoading: membersLoading } = useGetMembers({
		workspaceId,
	});
	const { presenceState, onlineCount } = useWorkspacePresence({ workspaceId });

	// Combine member data with presence data
	const teamMembers = useMemo(() => {
		if (!members) return [];

		// Create a map of online users for quick lookup
		const onlineUsers = new Set(
			presenceState.filter((p) => p.online).map((p) => p.userId)
		);

		return members
			.map((member) => {
				const isOnline = onlineUsers.has(member.userId);

				return {
					...member,
					status: isOnline ? "online" : "offline",
					statusEmoji: "",
					isOnline,
					lastActive: member._creationTime || Date.now(),
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
	}, [members, presenceState]);

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
			<div className="flex items-center justify-between pr-8">
				<div className="flex items-center gap-2">
					<Users className="h-5 w-5 text-primary" />
					<h3 className="font-medium">Team Status</h3>
					{!isEditMode && onlineCount > 0 && (
						<Badge variant="default" className="ml-2">
							{onlineCount} online
						</Badge>
					)}
				</div>
			</div>

			{teamMembers.length > 0 ? (
				<ScrollArea className="h-[250px] rounded-md border-2">
					<div className="space-y-2 p-4">
						{teamMembers.map((teamMember) => (
							<Card key={teamMember._id} className="overflow-hidden border-2">
								<CardContent className="p-3">
									<div className="flex items-start gap-3">
										<div className="relative">
											<Avatar className="h-8 w-8">
												<AvatarImage
													src={teamMember.user?.image}
													alt={teamMember.user?.name ?? "User avatar"}
												/>
												<AvatarFallback>
													{teamMember.user?.name
														? teamMember.user.name.charAt(0).toUpperCase()
														: "U"}
												</AvatarFallback>
											</Avatar>
											<div className="absolute bottom-0 right-0 rounded-full border-2 border-background">
												{teamMember.isOnline ? (
													<CircleCheck className="h-3 w-3 fill-green-500 text-background" />
												) : (
													<Circle className="h-3 w-3 fill-gray-400 text-background" />
												)}
											</div>
										</div>
										<div className="flex-1 space-y-1">
											<div className="flex items-center justify-between">
												<div className="flex items-center gap-2">
													<p className="font-medium">
														{teamMember.user?.name ?? "Unknown User"}
													</p>
													<Badge variant="outline" className="border-2 text-xs">
														{teamMember.role}
													</Badge>
												</div>
												<div className="flex items-center text-xs text-muted-foreground">
													<Clock className="mr-1 h-3 w-3" />
													{teamMember.isOnline
														? "Online now"
														: `Last seen ${formatDistanceToNow(new Date(teamMember.lastActive), { addSuffix: true })}`}
												</div>
											</div>
											{teamMember.status && (
												<p className="text-sm text-muted-foreground">
													{teamMember.statusEmoji &&
														`${teamMember.statusEmoji} `}
													{teamMember.status}
												</p>
											)}
											<Button
												variant="ghost"
												size="sm"
												className="mt-1 w-full justify-start text-primary"
												onClick={() => handleStartChat(teamMember.userId)}
											>
												<MessageSquare className="mr-2 h-3.5 w-3.5" />
												Message
											</Button>
										</div>
									</div>
								</CardContent>
							</Card>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
					<Users className="mb-2 h-10 w-10 text-muted-foreground" />
					<h3 className="text-lg font-medium">No team members</h3>
					<p className="text-sm text-muted-foreground">
						Invite members to see their status here
					</p>
				</div>
			)}
		</div>
	);
};
