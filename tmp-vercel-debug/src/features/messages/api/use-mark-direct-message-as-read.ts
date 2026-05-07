import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const useMarkDirectMessageAsRead = () => {
	const markAsRead = useMutation(api.direct.markDirectMessageAsRead);

	return async (messageId: Id<"messages">) => {
		try {
			await markAsRead({ messageId });
			return true;
		} catch (error) {
			console.error("Failed to mark direct message as read:", error);
			return false;
		}
	};
};
