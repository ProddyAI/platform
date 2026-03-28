"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetMembersProps {
	workspaceId: Id<"workspaces">;
}

export type GetMembersReturnType = typeof api.members.get._returnType;

export const useGetMembers = ({ workspaceId }: UseGetMembersProps) => {
	const data = useQuery(api.members.get, { workspaceId }) as any;

	const isLoading = data === undefined;

	return { data, isLoading };
};
