import { useMutation, useQuery } from "convex/react";
import { useCallback } from "react";
import { toast } from "sonner";

import { api } from "@/../convex/_generated/api";

export const useUserPreferences = () => {
	const data = useQuery(api.preferences.getUserPreferences);
	const updatePreferences = useMutation(api.preferences.updateUserPreferences);

	const updateSettings = useCallback(
		async (settings: {
			theme?: string;
			statusTracking?: boolean;
			notifications?: {
				mentions?: boolean;
				assignee?: boolean;
				threadReply?: boolean;
				directMessage?: boolean;
				inviteSent?: boolean;
				workspaceJoin?: boolean;
				onlineStatus?: boolean;
				weeklyDigest?: boolean;
				weeklyDigestDay?:
					| "monday"
					| "tuesday"
					| "wednesday"
					| "thursday"
					| "friday"
					| "saturday"
					| "sunday";
			};
		}) => {
			try {
				await updatePreferences({ settings });
				toast.success("Preferences updated successfully");
			} catch (error) {
				console.error("Failed to update preferences:", error);
				toast.error("Failed to update preferences");
			}
		},
		[updatePreferences]
	);

	return {
		data,
		updateSettings,
		isLoading: data === undefined,
	};
};

export const useStatusTrackingEnabled = () => {
	const data = useQuery(api.preferences.isStatusTrackingEnabled);
	return {
		isEnabled: data ?? true, // Default to true
		isLoading: data === undefined,
	};
};

export const useNotificationPreferences = () => {
	const data = useQuery(api.preferences.getNotificationPreferences);
	return {
		data,
		isLoading: data === undefined,
	};
};
