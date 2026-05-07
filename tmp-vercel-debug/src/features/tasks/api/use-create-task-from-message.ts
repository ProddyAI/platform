"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useCreateTaskFromMessage = () => {
	const createTaskFromMessage = useMutation(api.tasks.createTaskFromMessage);

	return createTaskFromMessage;
};
