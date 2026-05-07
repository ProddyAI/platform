import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetThreadMessages = () => {
	const workspaceId = useWorkspaceId();

	return useQuery(api.messages.getThreadMessages, { workspaceId });
};
