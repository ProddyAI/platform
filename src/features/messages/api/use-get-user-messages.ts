import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetUserMessages = () => {
	const workspaceId = useWorkspaceId();

	const data = useQuery(api.messages.getUserMessages, { workspaceId });

	return data;
};
