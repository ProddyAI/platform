import { useAction } from "convex/react";
import { api } from "@/../convex/_generated/api";

export const useAiSearch = () => {
	const aiSearchMutation = useAction(api.search.aiSearchMessages);

	return {
		searchWithAi: aiSearchMutation,
	};
};
