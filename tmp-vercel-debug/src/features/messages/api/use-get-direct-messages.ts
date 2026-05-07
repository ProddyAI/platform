import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetDirectMessages = (includeRead?: boolean) => {
	const workspaceId = useWorkspaceId();

	// Use the direct query
	const result = useQuery(
		api.direct.getDirectMessagesForCurrentUser,
		workspaceId
			? {
					workspaceId,
					includeRead,
				}
			: "skip"
	);

	const isLoading = result === undefined;

	// Filter by read status if needed
	let data = result || [];
	if (includeRead === false && data.length > 0) {
		data = data.filter((message: any) => !message.read);
	}

	return { data, isLoading };
};
