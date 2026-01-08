"use client";

import usePresence from "@convex-dev/presence/react";
import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseChannelPresenceProps {
	workspaceId?: Id<"workspaces">;
	channelId?: Id<"channels">;
}

export interface UseChannelPresenceReturn {
	presenceState: Array<{
		userId: string;
		online: boolean;
		user: {
			name: string;
			image?: string;
		};
		memberId?: Id<"members">;
	}>;
	isOnline: boolean;
	onlineCount: number;
}

export const useChannelPresence = ({
	workspaceId,
	channelId,
}: UseChannelPresenceProps): UseChannelPresenceReturn => {
	const currentUser = useQuery(api.users.current);
	const members = useQuery(
		api.members.get,
		workspaceId ? { workspaceId } : "skip"
	);

	const userIdForHook = (currentUser?._id as string | undefined) || "anonymous";

	const presenceState = usePresence(
		{
			heartbeat: api.presence.heartbeat,
			list: api.presence.list,
			disconnect: api.presence.disconnect,
		},
		channelId ? `channel-${channelId}` : "channel-unknown",
		userIdForHook
	);

	const enrichedPresence =
		presenceState?.map((presence) => {
			const member = members?.find((m) => m.userId === presence.userId);
			return {
				...presence,
				user: member?.user
					? {
							name: member.user.name || "Unknown User",
							...(member.user.image ? { image: member.user.image } : {}),
						}
					: { name: "Unknown User" },
				memberId: member?._id,
			};
		}) || [];

	return {
		presenceState: enrichedPresence,
		isOnline: enrichedPresence.length > 0,
		onlineCount: enrichedPresence.length,
	};
};
