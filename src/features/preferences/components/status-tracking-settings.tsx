"use client";

import { Activity, EyeOff } from "lucide-react";
import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useUserPreferences } from "../api/use-user-preferences";

export const StatusTrackingSettings = () => {
	const { data: preferences, updateSettings, isLoading } = useUserPreferences();
	const [isUpdating, setIsUpdating] = useState(false);

	const handleStatusTrackingToggle = async (enabled: boolean) => {
		setIsUpdating(true);
		try {
			await updateSettings({
				statusTracking: enabled,
			});
		} finally {
			setIsUpdating(false);
		}
	};

	if (isLoading) {
		return (
			<div className="space-y-4">
				<div className="flex items-center justify-between">
					<div className="space-y-1">
						<Label className="flex items-center gap-2 text-base font-medium">
							<Activity className="h-4 w-4" />
							Status Tracking
						</Label>
						<p className="text-sm text-muted-foreground">Loading...</p>
					</div>
					<Switch disabled />
				</div>
			</div>
		);
	}

	const statusTrackingEnabled = preferences?.settings?.statusTracking ?? true;

	return (
		<div className="space-y-4">
			<div className="flex items-center justify-between">
				<div className="space-y-1">
					<Label className="flex items-center gap-2 text-base font-medium">
						<Activity className="h-4 w-4" />
						Status Tracking
					</Label>
					<p className="text-sm text-muted-foreground">
						Allow others to see when you're online and your last seen time. When disabled, your status bubble will be hidden.
					</p>
				</div>
				<Switch
					checked={statusTrackingEnabled}
					onCheckedChange={handleStatusTrackingToggle}
					disabled={isUpdating}
				/>
			</div>

			{!statusTrackingEnabled && (
				<div className="rounded-lg bg-muted/50 p-3">
					<div className="flex items-center gap-2 text-sm">
						<EyeOff className="h-4 w-4 text-muted-foreground" />
						<span className="text-muted-foreground">
							Your status bubble will be hidden from others, and your last seen
							time won't be tracked
						</span>
					</div>
				</div>
			)}
		</div>
	);
};
