"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetSprintsProps {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const useGetSprints = ({
	projectId,
	workspaceId,
}: UseGetSprintsProps) => {
	const data = useQuery(api.sprints.getByProject, { projectId, workspaceId });
	return { data, isLoading: data === undefined };
};
