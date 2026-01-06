"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetChannelPresenceProps {
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
}

export const useGetChannelPresence = ({
	workspaceId,
	channelId,
}: UseGetChannelPresenceProps) => {
	// Use the new presence system for channel presence
	const roomToken = `channel-${channelId}`;
	const data = useQuery(api.presence.list, { roomToken });

	const isLoading = data === undefined;

	return { data: data || [], isLoading };
};
