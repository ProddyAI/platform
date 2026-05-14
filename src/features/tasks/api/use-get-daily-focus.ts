import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetDailyFocusProps {
	workspaceId: Id<"workspaces">;
	limit?: number;
}

export const useGetDailyFocus = ({ workspaceId, limit = 5 }: UseGetDailyFocusProps) => {
	const data = useQuery(api.stress.getDailyFocusTasks, { workspaceId, limit });
	const isLoading = data === undefined;
	return { data, isLoading };
};
