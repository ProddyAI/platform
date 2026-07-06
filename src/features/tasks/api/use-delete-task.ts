"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useDeleteTask = () => {
	const deleteTask = useMutation(api.planning.tasks.deleteTask);

	return deleteTask;
};
