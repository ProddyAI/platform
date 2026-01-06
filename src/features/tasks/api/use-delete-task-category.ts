"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useDeleteTaskCategory = () => {
	const deleteTaskCategory = useMutation(api.tasks.deleteTaskCategory);

	return deleteTaskCategory;
};
