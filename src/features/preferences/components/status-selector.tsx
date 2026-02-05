"use client";

import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useStatusTrackingEnabled, useUserPreferences } from "../api/use-user-preferences";

export const StatusSelector = () => {
	const workspaceId = useWorkspaceId();
	const setUserStatus = useMutation(api.userStatus.setUserStatus);
	const { isEnabled: statusTrackingEnabled, isLoading: isLoadingTracking } =
		useStatusTrackingEnabled();
	const { data: preferences } = useUserPreferences();
	const [isUpdating, setIsUpdating] = useState(false);
	const [isDndEnabled, setIsDndEnabled] = useState(false);

	// Sync isDndEnabled with backend preferences
	useEffect(() => {
		if (preferences?.settings?.userStatus) {
			setIsDndEnabled(preferences.settings.userStatus === "dnd");
		}
	}, [preferences]);

	const handleDndToggle = async (enabled: boolean) => {
		setIsUpdating(true);
		try {
			await setUserStatus({
				workspaceId,
				status: enabled ? "dnd" : "online",
			});
			setIsDndEnabled(enabled);
			toast.success(
				enabled ? "Do Not Disturb enabled" : "Do Not Disturb disabled"
			);
		} catch (error) {
			console.error("Failed to update status:", error);
			toast.error("Failed to update status");
		} finally {
			setIsUpdating(false);
		}
	};

	const isDisabled = !statusTrackingEnabled || isUpdating || isLoadingTracking;

	// Hide DND toggle when status tracking is disabled
	if (!statusTrackingEnabled) {
		return null;
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<Label className="flex items-center gap-2 text-base font-medium">
						<Moon className="h-4 w-4" />
						Do Not Disturb
					</Label>
					<p className="text-sm text-muted-foreground">
						Set your status to Do Not Disturb. Your status bubble will show red.
					</p>
				</div>
				<Switch
					checked={isDndEnabled}
					disabled={isUpdating || isLoadingTracking}
					onCheckedChange={handleDndToggle}
				/>
			</div>

			{!isDndEnabled && (
				<div className="rounded-lg bg-muted/50 p-3">
					<p className="text-xs text-muted-foreground">
						💡 <strong>Automatic Status:</strong> Your status automatically
						shows green when online, yellow if idle, and gray if offline based on
						your activity.
					</p>
				</div>
			)}
		</div>
	);
};
