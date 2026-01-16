"use client";

import usePresence from "@convex-dev/presence/react";
import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseChannelPresenceProps {
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
}

export const useChannelPresence = ({
	workspaceId,
	channelId,
}: UseChannelPresenceProps) => {
	const currentUser = useQuery(api.users.current);
	const members = useQuery(api.members.get, { workspaceId });

	const userIdForHook = (currentUser?._id as string | undefined) || "anonymous";

	const presenceState = usePresence(
		{
			heartbeat: api.presence.heartbeat,
			list: api.presence.list,
			disconnect: api.presence.disconnect,
		},
		`channel-${channelId}`,
		userIdForHook
	);

	const enrichedPresence =
		presenceState?.map((presence) => {
			const member = members?.find((m) => m.userId === presence.userId);
			return {
				...presence,
				user: member?.user || {
					name: currentUser?.name || "Anonymous",
					image: currentUser?.image,
				},
				memberId: member?._id,
			};
		}) || [];

	return {
		presenceState: enrichedPresence,
		isOnline: (presenceState?.length || 0) > 0,
		onlineCount: presenceState?.length || 0,
	};
};
