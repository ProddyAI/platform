import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useGetUnreadMentionsCount = () => {
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

	// Initialize counts
	const counts: {
		total: number;
		channel: number;
		direct: number;
		thread: number;
		card: number;
		[key: string]: number;
	} = {
		total: 0,
		channel: 0,
		direct: 0,
		thread: 0,
		card: 0,
	};

	// Calculate counts by type if we have data
	if (result && result.length > 0) {
		// Filter for unread mentions only
		const unreadMentions = result.filter((mention: any) => !mention.read);
		counts.total = unreadMentions.length;

		unreadMentions.forEach((mention: any) => {
			if (mention.source?.type) {
				const type = mention.source.type as string;
				counts[type] = (counts[type] || 0) + 1;
			}
		});
	}

	return {
		counts,
		isLoading: result === undefined,
	};
};
