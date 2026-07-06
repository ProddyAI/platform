import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface useGetWorkspaceInfoProps {
	id: Id<"workspaces">;
}

export const useGetWorkspaceInfo = ({ id }: useGetWorkspaceInfoProps) => {
	const data = useQuery(api.workspace.workspaces.getInfoById, { id });
	const isLoading = data === undefined;

	return { data, isLoading };
};
