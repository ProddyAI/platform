import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseGetImportConnectionsProps {
	workspaceId: Id<"workspaces">;
}

export const useGetImportConnections = ({
	workspaceId,
}: UseGetImportConnectionsProps) => {
	const data = useQuery(api.importIntegrations.getConnections, { workspaceId });
	const isLoading = data === undefined;

	return { data, isLoading };
};
