"use client";

import usePresence from "@convex-dev/presence/react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

interface UseWorkspacePresenceProps {
	workspaceId: Id<"workspaces">;
}

export const useWorkspacePresence = ({
	workspaceId,
}: UseWorkspacePresenceProps) => {
	// Get current user to use their actual name
	const currentUser = useQuery(api.users.current);
	const actualUserName = currentUser?.name || "Anonymous";

	// Use the Convex presence hook for workspace-level presence
	const presenceState = usePresence(
		{
			heartbeat: api.presence.heartbeat,
			list: api.presence.list,
			disconnect: api.presence.disconnect,
		},
		`workspace-${workspaceId}`,
		actualUserName
	);

	// Get members data to enrich presence information
	const members = useQuery(api.members.get, { workspaceId });

	// Combine presence data with member information
	const enrichedPresence =
		presenceState?.map((presence) => {
			const member = members?.find((m) => m.userId === presence.userId);
			return {
				...presence,
				user: member?.user || {
					name: actualUserName,
					image: undefined,
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

export const useUserPresence = (userId?: Id<"users">) => {
	const presenceData = useQuery(
		api.presence.listUserPresence,
		userId ? { userId } : "skip"
	);

	return {
		isOnline: (presenceData?.length || 0) > 0,
		rooms: presenceData || [],
	};
};

// Hook to get presence for multiple users efficiently
export const useMultipleUserPresence = (_userIds: Id<"users">[]) => {
	const workspaceId = useWorkspaceId();
	const { presenceState } = useWorkspacePresence({ workspaceId });

	// Create a map of online users for quick lookup
	const onlineUsers = new Set(
		presenceState.filter((p) => p.online).map((p) => p.userId)
	);

	return {
		isUserOnline: (userId: Id<"users">) => onlineUsers.has(userId),
		onlineUsers: Array.from(onlineUsers),
	};
};
