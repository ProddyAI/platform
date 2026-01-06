import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const useMarkMentionAsRead = () => {
	const markMention = useMutation(api.mentions.markMentionAsRead);

	const execute = async (mentionId: Id<"mentions">, status?: boolean) => {
		try {
			if (!mentionId) {
				return false;
			}

			await markMention({
				mentionId,
				status, // If undefined, the backend will default to marking as read
			});

			return true;
		} catch (_error) {
			return false;
		}
	};

	return execute;
};
