"use client";

import { Activity, Circle, Moon, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { UserStatus } from "@/features/presence/components/presence-indicator";

const statusOptions: Array<{
	value: UserStatus;
	label: string;
	icon: React.ElementType;
	description: string;
}> = [
	{
		value: "online",
		label: "Online",
		icon: Circle,
		description: "Green dot - Available and active",
	},
	{
		value: "idle",
		label: "Away",
		icon: Moon,
		description: "Yellow dot - Temporarily away",
	},
	{
		value: "dnd",
		label: "Do Not Disturb",
		icon: X,
		description: "Red dot - Focused work mode",
	},
	{
		value: "offline",
		label: "Appear Offline",
		icon: Circle,
		description: "Gray dot - Not available",
	},
];

export const StatusSelector = () => {
	const workspaceId = useWorkspaceId();
	const setUserStatus = useMutation(api.userStatus.setUserStatus);
	const [isUpdating, setIsUpdating] = useState(false);
	const [currentStatus, setCurrentStatus] = useState<UserStatus>("online");

	const handleStatusChange = async (status: UserStatus) => {
		setIsUpdating(true);
		try {
			await setUserStatus({
				workspaceId,
				status,
			});
			setCurrentStatus(status);
			toast.success(`Status updated to ${status}`);
		} catch (error) {
			console.error("Failed to update status:", error);
			toast.error("Failed to update status");
		} finally {
			setIsUpdating(false);
		}
	};

	const getStatusColor = (status: UserStatus) => {
		switch (status) {
			case "online":
				return "text-green-500";
			case "idle":
				return "text-yellow-500";
			case "dnd":
				return "text-red-500";
			case "offline":
				return "text-gray-400";
			default:
				return "text-gray-400";
		}
	};

	return (
		<div className="space-y-4">
			<div className="space-y-2">
				<Label className="flex items-center gap-2 text-base font-medium">
					<Activity className="h-4 w-4" />
					Your Status
				</Label>
				<p className="text-sm text-muted-foreground">
					Set how you appear to others in this workspace
				</p>
			</div>

			<Select
				value={currentStatus}
				onValueChange={(value) => handleStatusChange(value as UserStatus)}
				disabled={isUpdating}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{statusOptions.map((option) => {
						const Icon = option.icon;
						return (
							<SelectItem key={option.value} value={option.value}>
								<div className="flex items-center gap-2">
									<Icon
										className={`h-3 w-3 ${getStatusColor(option.value)}`}
									/>
									<div className="flex flex-col">
										<span className="font-medium">{option.label}</span>
										<span className="text-xs text-muted-foreground">
											{option.description}
										</span>
									</div>
								</div>
							</SelectItem>
						);
					})}
				</SelectContent>
			</Select>

			<div className="rounded-lg bg-muted/50 p-3">
				<p className="text-xs text-muted-foreground">
					💡 <strong>Automatic Status:</strong> Your status shows green when online, 
					yellow if you were active within 5 minutes, and gray if offline for more than 6 minutes. 
					Setting "Do Not Disturb" will keep your dot red regardless of activity.
				</p>
			</div>
		</div>
	);
};
