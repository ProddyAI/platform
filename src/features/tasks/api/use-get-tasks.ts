"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetTasksProps {
	workspaceId: Id<"workspaces">;
}

export const useGetTasks = ({ workspaceId }: UseGetTasksProps) => {
	const data = useQuery(api.tasks.getTasks, { workspaceId });
	const isLoading = data === undefined;

	return { data, isLoading };
};
