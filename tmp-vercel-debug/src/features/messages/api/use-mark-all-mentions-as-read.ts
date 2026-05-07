import { useMutation } from "convex/react";

import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useMarkAllMentionsAsRead = () => {
	const workspaceId = useWorkspaceId();
	const markAllAsRead = useMutation(api.mentions.markAllMentionsAsRead);

	const execute = async () => {
		try {
			if (!workspaceId) {
				return false;
			}

			await markAllAsRead({ workspaceId });
			return true;
		} catch (_error) {
			return false;
		}
	};

	return execute;
};
