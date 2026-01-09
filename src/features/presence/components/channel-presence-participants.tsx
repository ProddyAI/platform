"use client";

import { useMemo } from "react";
import { Hint } from "@/components/hint";
import { ParticipantAvatar } from "@/components/participant-avatar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { useChannelPresence } from "@/features/presence/hooks/use-channel-presence";
import { useChannelId } from "@/hooks/use-channel-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const MAX_SHOWN_USERS = 4;

export const ChannelPresenceParticipants = () => {
	const workspaceId = useWorkspaceId();
	const channelId = useChannelId();
	const { presenceState } = useChannelPresence({
		workspaceId,
		channelId,
	});

	const onlineUsers = useMemo(
		() => presenceState.filter((p) => p.online),
		[presenceState]
	);

	if (!onlineUsers.length) return null;

	const shown = onlineUsers.slice(0, MAX_SHOWN_USERS);
	const hasMore = onlineUsers.length > MAX_SHOWN_USERS;

	return (
		<div className="flex items-center gap-2">
			{shown
				.filter((p) => !!(p.memberId || p.userId))
				.map((p) => {
				const name = p.user?.name || "User";
				const key = p.memberId || p.userId;
				return (
					<ParticipantAvatar
						key={key}
						name={name}
						userId={p.userId}
						image={p.user?.image}
						hintLabel={name}
						side="bottom"
					/>
				);
				})}

			{hasMore && (
				<Hint
					label={`${onlineUsers.length - MAX_SHOWN_USERS} more`}
					side="bottom"
				>
					<Avatar className="h-7 w-7 border-2 border-muted">
						<AvatarFallback className="text-xs font-semibold bg-muted">
							+{onlineUsers.length - MAX_SHOWN_USERS}
						</AvatarFallback>
					</Avatar>
				</Hint>
			)}
		</div>
	);
};
