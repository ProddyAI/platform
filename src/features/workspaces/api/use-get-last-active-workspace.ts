import { useQuery } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useGetLastActiveWorkspace = () => {
	const data = useQuery(api.workspace.preferences.getLastActiveWorkspace);
	const isLoading = data === undefined;

	return { data, isLoading };
};
