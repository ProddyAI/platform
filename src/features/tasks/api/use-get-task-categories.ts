"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetTaskCategoriesProps {
	workspaceId: Id<"workspaces">;
}

export const useGetTaskCategories = ({
	workspaceId,
}: UseGetTaskCategoriesProps) => {
	const data = useQuery(api.tasks.getTaskCategories, { workspaceId });
	const isLoading = data === undefined;

	return { data, isLoading };
};
