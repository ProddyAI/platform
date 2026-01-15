import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";

export const useUpdateLastActiveWorkspace = () => {
	return useMutation(api.preferences.updateLastActiveWorkspace);
};
