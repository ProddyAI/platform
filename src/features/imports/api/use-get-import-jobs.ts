import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetImportJobsProps {
	workspaceId: Id<"workspaces">;
	limit?: number;
}

export const useGetImportJobs = ({
	workspaceId,
	limit,
}: UseGetImportJobsProps) => {
	const data = useQuery(api.importIntegrations.getJobs, {
		workspaceId,
		limit,
	});
	const isLoading = data === undefined;

	return { data, isLoading };
};
