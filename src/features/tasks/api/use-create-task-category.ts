"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useCreateTaskCategory = () => {
	const createTaskCategory = useMutation(api.planning.tasks.createTaskCategory);

	return createTaskCategory;
};
