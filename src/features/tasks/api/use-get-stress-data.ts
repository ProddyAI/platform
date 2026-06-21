import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetStressDataProps {
	workspaceId: Id<"workspaces">;
}

export const useGetStressData = ({ workspaceId }: UseGetStressDataProps) => {
	const data = useQuery(api.stress.getStressMetrics, { workspaceId });
	const isLoading = data === undefined;
	return { data, isLoading };
};
