/**
 * Hook to find duplicate imported channels
 */
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import type { Id } from "../../../../convex/_generated/dataModel";

export const useFindDuplicateChannels = (
	workspaceId: Id<"workspaces"> | null,
	platform: "slack" | "todoist" | "linear" | "notion" | "miro" | "clickup"
) => {
	return useQuery(
		api.importIntegrations.findDuplicateChannels,
		workspaceId && platform ? { workspaceId, platform } : "skip"
	);
};
