"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useWorkspaceId } from "./use-workspace-id";

export type FeatureKey =
	| "aiRequest"
	| "aiDiagram"
	| "aiSummary"
	| "message"
	| "task"
	| "channel"
	| "board"
	| "note";

export const useWorkspaceLimit = (featureKey: FeatureKey) => {
	const workspaceId = useWorkspaceId();
	const usage = useQuery(
		api.usageTracking.getWorkspaceUsage,
		workspaceId ? { workspaceId } : "skip"
	);

	if (usage === undefined || !workspaceId) {
		return {
			isLoading: true,
			maxReached: false,
			limit: 0,
			used: 0,
			unlimited: false,
		};
	}

	if (usage === null) {
		return {
			isLoading: false,
			maxReached: false,
			limit: 0,
			used: 0,
			unlimited: false,
		};
	}

	let featureStats: { used: number; limit: number } | undefined;

	switch (featureKey) {
		case "aiRequest":
			featureStats = usage.ai.requests;
			break;
		case "aiDiagram":
			featureStats = usage.ai.diagrams;
			break;
		case "aiSummary":
			featureStats = usage.ai.summaries;
			break;
		case "message":
			featureStats = usage.collaboration.messages;
			break;
		case "task":
			featureStats = usage.collaboration.tasks;
			break;
		case "channel":
			featureStats = usage.collaboration.channels;
			break;
		case "board":
			featureStats = usage.collaboration.boards;
			break;
		case "note":
			featureStats = usage.collaboration.notes;
			break;
	}

	const used = featureStats?.used ?? 0;
	const limit = featureStats?.limit ?? 0;
	const unlimited = limit === -1;
	const maxReached = !unlimited && used >= limit;

	return {
		isLoading: false,
		maxReached,
		limit,
		used,
		unlimited,
	};
};
