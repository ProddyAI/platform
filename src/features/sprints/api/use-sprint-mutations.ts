"use client";

import { useMutation } from "convex/react";
import { useCallback, useState } from "react";

import { api } from "@/../convex/_generated/api";

// Thin wrapper around a Convex mutation that tracks a `isPending` flag, so
// callers can disable buttons while a request is in flight.
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

export const useCreateSprint = () =>
	useTrackedMutation(useMutation(api.planning.sprints.create));

export const useUpdateSprint = () =>
	useTrackedMutation(useMutation(api.planning.sprints.update));

export const useRemoveSprint = () =>
	useTrackedMutation(useMutation(api.planning.sprints.remove));

export const useAddSprintIssues = () =>
	useTrackedMutation(useMutation(api.planning.sprints.addIssues));

export const useRemoveSprintIssue = () =>
	useTrackedMutation(useMutation(api.planning.sprints.removeIssue));

export const useRolloverSprint = () =>
	useTrackedMutation(useMutation(api.planning.sprints.rolloverIncomplete));
