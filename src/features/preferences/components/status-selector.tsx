"use client";

import { useMutation } from "convex/react";
import { Moon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useStatusTrackingEnabled,
	useUserPreferences,
} from "../api/use-user-preferences";

export const StatusSelector = () => {
	const workspaceId = useWorkspaceId();
	const setUserStatus = useMutation(api.workspace.userStatus.setUserStatus);
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
		if (!workspaceId) {
			toast.error("Workspace not found");
			return;
		}

		setIsUpdating(true);
		try {
			await setUserStatus({
				workspaceId,
				status: enabled ? "dnd" : "online",
			});
			setIsDndEnabled(enabled);
		} catch (error) {
			console.error("Failed to update status:", error);
			toast.error("Failed to update status");
		} finally {
			setIsUpdating(false);
		}
	};

	const _isDisabled = !statusTrackingEnabled || isUpdating || isLoadingTracking;

	// Show loading skeleton while checking tracking status
	if (isLoadingTracking) {
		return null;
	}

	// Status tracking must be on for Do Not Disturb to take effect
	if (!statusTrackingEnabled) {
		return (
			<div className="flex items-center justify-between opacity-60">
				<div className="space-y-1">
					<Label
						className="flex items-center gap-2 text-base font-medium"
						htmlFor="dnd-toggle"
					>
						<Moon className="h-4 w-4" />
						Do Not Disturb
					</Label>
					<p className="text-sm text-muted-foreground">
						Turn on status tracking to use Do Not Disturb.
					</p>
				</div>
				<Switch checked={isDndEnabled} disabled id="dnd-toggle" />
			</div>
		);
	}

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<Label
						className="flex items-center gap-2 text-base font-medium"
						htmlFor="dnd-toggle"
					>
						<Moon className="h-4 w-4" />
						Do Not Disturb
					</Label>
					<p className="text-sm text-muted-foreground">
						Set your status to Do Not Disturb. Your status bubble will show red.
					</p>
				</div>
				<Switch
					checked={isDndEnabled}
					disabled={_isDisabled}
					id="dnd-toggle"
					onCheckedChange={handleDndToggle}
				/>
			</div>

			{!isDndEnabled && (
				<div className="rounded-lg bg-muted/50 p-3">
					<p className="text-xs text-muted-foreground">
						Your status updates automatically: green when online, yellow when
						idle, gray when offline, based on your activity.
					</p>
				</div>
			)}
		</div>
	);
};
