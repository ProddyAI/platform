"use client";

import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseActiveSprintProps {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const useGetActiveSprint = ({
	projectId,
	workspaceId,
}: UseActiveSprintProps) => {
	const data = useQuery(api.sprints.getActiveSprint, {
		projectId,
		workspaceId,
	});
	return { data, isLoading: data === undefined };
};

export const useGetSprintIssues = ({
	sprintId,
}: {
	sprintId: Id<"sprints"> | null;
}) => {
	const data = useQuery(
		api.sprints.getSprintIssues,
		sprintId ? { sprintId } : "skip"
	);
	return { data: data ?? [], isLoading: data === undefined };
};

export const useGetSprintStats = ({
	sprintId,
}: {
	sprintId: Id<"sprints"> | null;
}) => {
	const data = useQuery(
		api.sprints.getSprintStats,
		sprintId ? { sprintId } : "skip"
	);
	return { data, isLoading: data === undefined };
};

export const useGetAddableSprintIssues = ({
	sprintId,
}: {
	sprintId: Id<"sprints"> | null;
}) => {
	const data = useQuery(
		api.sprints.getAddableIssues,
		sprintId ? { sprintId } : "skip"
	);
	return { data: data ?? [], isLoading: data === undefined };
};
