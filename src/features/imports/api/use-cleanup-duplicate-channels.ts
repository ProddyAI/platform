/**
 * Hook to clean up duplicate imported channels
 */
import { useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";

export const useCleanupDuplicateChannels = () => {
	const mutation = useMutation(api.importIntegrations.cleanupDuplicateChannels);

	return {
		cleanup: mutation,
	};
};
