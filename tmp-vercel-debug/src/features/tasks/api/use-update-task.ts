"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useUpdateTask = () => {
	const updateTask = useMutation(api.tasks.updateTask);

	return updateTask;
};
