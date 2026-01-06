import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseUpdateLastActiveWorkspaceProps {
	workspaceId: Id<"workspaces">;
}

export const useUpdateLastActiveWorkspace = () => {
	return useMutation(api.preferences.updateLastActiveWorkspace);
};
