"use client";

import { useQuery } from "convex/react";
import { useCallback, useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import type { UserStatus } from "@/../convex/userStatus";

interface UseUserStatusProps {
	userId?: Id<"users">;
	workspaceId: Id<"workspaces">;
}

export const useUserStatus = ({ userId, workspaceId }: UseUserStatusProps) => {
	const data = useQuery(
		api.userStatus.getUserStatus,
		userId ? { userId, workspaceId } : "skip"
	);

	const status = (data?.status as UserStatus) || "offline";

	return {
		status,
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

	const getUserStatus = useCallback(
		(userId: Id<"users">): UserStatus => {
			return (data?.[userId]?.status as UserStatus) || "offline";
		},
		[data]
	);

	return useMemo(
		() => ({
			statusMap: data || {},
			getUserStatus,
		}),
		[data, getUserStatus]
	);
};
