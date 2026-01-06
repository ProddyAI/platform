import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetUnreadDirectMessagesCount = () => {
	const workspaceId = useWorkspaceId();

	const result = useQuery(
		api.direct.getUnreadDirectMessageCount,
		workspaceId
			? {
					workspaceId,
				}
			: "skip"
	);

	const isLoading = result === undefined;
	const counts = result || { total: 0, direct: 0 };

	return { counts, isLoading };
};
