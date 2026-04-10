"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetChannelPresenceProps {
	channelId: Id<"channels">;
}

export const useGetChannelPresence = ({
	channelId,
}: UseGetChannelPresenceProps) => {
	// Use the new presence system for channel presence
	const roomToken = `channel-${channelId}`;
	const data = useQuery(api.presence.list, { roomToken });

	const isLoading = data === undefined;

	return { data: data || [], isLoading };
};
