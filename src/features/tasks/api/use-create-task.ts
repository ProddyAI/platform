"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useCreateTask = () => {
	const createTask = useMutation(api.planning.tasks.createTask);

	return createTask;
};
