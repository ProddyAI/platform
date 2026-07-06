"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseCurrentMemberProps {
	workspaceId?: Id<"workspaces">;
}

export const useCurrentMember = ({ workspaceId }: UseCurrentMemberProps) => {
	const data = useQuery(
		api.workspace.members.current,
		workspaceId ? { workspaceId } : "skip"
	);

	const isLoading = workspaceId !== undefined && data === undefined;

	return { data, isLoading };
};
