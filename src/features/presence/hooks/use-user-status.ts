"use client";

import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import type { UserStatus } from "../components/presence-indicator";

interface UseUserStatusProps {
	userId?: Id<"users">;
	workspaceId: Id<"workspaces">;
}

export const useUserStatus = ({ userId, workspaceId }: UseUserStatusProps) => {
	const data = useQuery(
		api.userStatus.getUserStatus,
		userId ? { userId, workspaceId } : "skip"
	);

	return {
		status: (data?.status as UserStatus) || "offline",
		lastSeen: data?.lastSeen || null,
	};
};

export const useMultipleUserStatuses = (
	userIds: Id<"users">[],
	workspaceId: Id<"workspaces">
) => {
	const data = useQuery(api.userStatus.getMultipleUserStatuses, {
		userIds,
		workspaceId,
	});

	return {
		statusMap: data || {},
		getUserStatus: (userId: Id<"users">): UserStatus => {
			return (data?.[userId]?.status as UserStatus) || "offline";
		},
	};
};
