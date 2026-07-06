import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetThreadMessages = () => {
	const workspaceId = useWorkspaceId();

	return useQuery(api.messaging.messages.getThreadMessages, {
		workspaceId: workspaceId as Id<"workspaces">,
	});
};
