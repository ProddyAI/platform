"use client";

import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useToggleTaskCompletion = () => {
	const toggleTaskCompletion = useMutation(api.tasks.toggleTaskCompletion);

	return toggleTaskCompletion;
};
