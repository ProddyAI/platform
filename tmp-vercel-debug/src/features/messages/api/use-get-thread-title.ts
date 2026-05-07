import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const useGetThreadTitle = (messageId: Id<"messages"> | null) => {
	const data = useQuery(
		api.threadTitles.getByMessageId,
		messageId ? { messageId } : "skip"
	);

	return {
		title: data?.title,
		isLoading: data === undefined && messageId !== null,
	};
};
