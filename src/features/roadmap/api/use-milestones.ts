"use client";

import { useMutation, useQuery } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const useTrackedMutation = <Args, Result>(
	mutationFn: (args: Args) => Promise<Result>
) => {
	const [isPending, setIsPending] = useState(false);

	const mutate = useCallback(
		async (args: Args) => {
			setIsPending(true);
			try {
				return await mutationFn(args);
			} finally {
				setIsPending(false);
			}
		},
		[mutationFn]
	);

	return { mutate, isPending };
};

export const useGetMilestones = ({
	projectId,
	workspaceId,
}: {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}) => {
	const data = useQuery(api.milestones.getByProject, {
		projectId,
		workspaceId,
	});
	return { data, isLoading: data === undefined };
};

export const useGetMilestoneStats = ({
	milestoneId,
}: {
	milestoneId: Id<"milestones"> | null;
}) => {
	const data = useQuery(
		api.milestones.getMilestoneStats,
		milestoneId ? { milestoneId } : "skip"
	);
	return { data, isLoading: data === undefined };
};

export const useGetMilestoneIssues = ({
	milestoneId,
}: {
	milestoneId: Id<"milestones"> | null;
}) => {
	const data = useQuery(
		api.milestones.getMilestoneIssues,
		milestoneId ? { milestoneId } : "skip"
	);
	return { data: data ?? [], isLoading: data === undefined };
};

export const useGetLinkableMilestoneIssues = ({
	milestoneId,
}: {
	milestoneId: Id<"milestones"> | null;
}) => {
	const data = useQuery(
		api.milestones.getLinkableIssues,
		milestoneId ? { milestoneId } : "skip"
	);
	return { data: data ?? [], isLoading: data === undefined };
};

export const useCreateMilestone = () =>
	useTrackedMutation(useMutation(api.milestones.create));

export const useUpdateMilestone = () =>
	useTrackedMutation(useMutation(api.milestones.update));

export const useRemoveMilestone = () =>
	useTrackedMutation(useMutation(api.milestones.remove));

export const useLinkMilestoneIssues = () =>
	useTrackedMutation(useMutation(api.milestones.linkIssues));

export const useUnlinkMilestoneIssue = () =>
	useTrackedMutation(useMutation(api.milestones.unlinkIssue));
