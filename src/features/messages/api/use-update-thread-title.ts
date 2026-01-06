import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const useUpdateThreadTitle = () => {
	const mutate = useMutation(api.threadTitles.upsert);

	return {
		updateTitle: async (
			messageId: Id<"messages">,
			title: string,
			workspaceId: Id<"workspaces">
		) => {
			return await mutate({ messageId, title, workspaceId });
		},
	};
};
