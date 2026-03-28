import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

type MentionedMessagesReturnType =
	typeof api.mentions.getProcessedMentions._returnType;

export const useGetMentionedMessages = (includeRead?: boolean) => {
	const workspaceId = useWorkspaceId();

	// Use the direct query
	const result = useQuery(
		api.mentions.getProcessedMentions,
		workspaceId
			? {
					workspaceId,
				}
			: "skip"
	);

	const isLoading = result === undefined;

	// Filter by read status if needed
	let data: MentionedMessagesReturnType = (result ||
		[]) as MentionedMessagesReturnType;
	if (includeRead === false && data.length > 0) {
		data = data.filter((mention) => !mention.read);
	}

	return { data, isLoading };
};
