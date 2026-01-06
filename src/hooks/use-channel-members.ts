"use client";

import { useQuery } from "convex/react";
import { useWorkspacePresence } from "@/features/presence/hooks/use-workspace-presence";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export const useChannelMembers = (
	workspaceId: Id<"workspaces">,
	_channelId: Id<"channels">
) => {
	// Get all members of the workspace
	const members = useQuery(api.members.get, { workspaceId });

	// Get the current user's member info
	const currentMember = useQuery(api.members.current, { workspaceId });

	// Get presence data using the new presence system
	const { presenceState } = useWorkspacePresence({ workspaceId });

	// Check if data is still loading
	const isLoading = members === undefined || currentMember === undefined;

	// Return early if data is still loading
	if (isLoading) {
		return { members: [], currentMember: null, isLoading: true };
	}

	// Create a stable reference to the status map
	const statusMap: Record<string, string> = {};

	// Only process presence data if it exists
	if (presenceState && presenceState.length > 0) {
		for (const presence of presenceState) {
			statusMap[presence.userId] = presence.online ? "online" : "offline";
		}
	}

	// Format members with their status - only if members exist
	const formattedMembers = members
		? members.map((member) => ({
				...member,
				status: statusMap[member.user?._id] || "offline",
			}))
		: [];

	// Return the processed data
	return {
		members: formattedMembers,
		currentMember,
		isLoading: false,
	};
};
