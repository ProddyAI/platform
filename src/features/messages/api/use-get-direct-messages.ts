import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

type DirectMessagesReturnType =
	typeof api.direct.getDirectMessagesForCurrentUser._returnType;

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
	let data: DirectMessagesReturnType = (result ||
		[]) as DirectMessagesReturnType;
	if (includeRead === false && data.length > 0) {
		data = data.filter((message) => !message.read);
	}

	return { data, isLoading };
};
