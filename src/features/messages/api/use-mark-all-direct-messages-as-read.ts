import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export const useMarkAllDirectMessagesAsRead = () => {
	const markAllAsRead = useMutation(api.direct.markAllDirectMessagesAsRead);
	const workspaceId = useWorkspaceId();

	return async () => {
		if (!workspaceId) return false;

		try {
			await markAllAsRead({ workspaceId });
			return true;
		} catch (error) {
			console.error("Failed to mark all direct messages as read:", error);
			return false;
		}
	};
};
