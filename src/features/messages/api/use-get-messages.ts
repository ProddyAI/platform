import { usePaginatedQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const BATCH_SIZE = 20;

interface UseGetMessagesProps {
	channelId?: Id<"channels">;
	conversationId?: Id<"conversations">;
	parentMessageId?: Id<"messages">;
}

export type GetMessagesReturnType =
	(typeof api.messages.get._returnType)["page"];

export const useGetMessages = ({
	channelId,
	conversationId,
	parentMessageId,
}: UseGetMessagesProps) => {
	// Check if we have valid parameters to make the query
	const shouldSkip = !channelId && !conversationId && !parentMessageId;

	const { results, status, loadMore } = usePaginatedQuery(
		api.messages.get,
		shouldSkip ? "skip" : { channelId, conversationId, parentMessageId },
		{ initialNumItems: BATCH_SIZE }
	);

	return {
		results: results || [],
		status,
		loadMore: () => loadMore(BATCH_SIZE),
	};
};
