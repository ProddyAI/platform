"use client";

import { useQuery } from "convex/react";
import { formatDistanceToNow } from "date-fns";
import {
	Activity,
	AlertCircle,
	Calendar,
	CheckCircle2,
	MessageSquare,
	Move,
	Plus,
	Shield,
	UserMinus,
	UserPlus,
	XCircle,
} from "lucide-react";
import type React from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BoardCardActivityProps {
	cardId: Id<"cards">;
}

type CardActivity = {
	_id: Id<"card_activity">;
	action: string;
	details?: string;
	timestamp: number;
	member: {
		user: {
			name?: string;
			image?: string;
		};
	};
};

const isCardActivityArray = (value: unknown): value is CardActivity[] => {
	if (!Array.isArray(value)) return false;
	return value.every((item) => {
		if (typeof item !== "object" || item === null) return false;
		const activity = item as Record<string, unknown>;
		if (typeof activity._id !== "string") return false;
		if (typeof activity.action !== "string") return false;
		if (typeof activity.timestamp !== "number") return false;
		if (
			activity.details !== undefined &&
			typeof activity.details !== "string"
		) {
			return false;
		}

		const member = activity.member;
		if (typeof member !== "object" || member === null) return false;
		const memberRecord = member as Record<string, unknown>;

		const user = memberRecord.user;
		if (typeof user !== "object" || user === null) return false;
		const userRecord = user as Record<string, unknown>;

		if (userRecord.name !== undefined && typeof userRecord.name !== "string") {
			return false;
		}
		if (
			userRecord.image !== undefined &&
			typeof userRecord.image !== "string"
		) {
			return false;
		}

		return true;
	});
};

export const BoardCardActivity: React.FC<BoardCardActivityProps> = ({
	cardId,
}) => {
	const rawActivities = useQuery(api.board.getCardActivity, {
		cardId,
	});
	const hasInvalidActivityData =
		rawActivities !== undefined && !isCardActivityArray(rawActivities);
	const activities = isCardActivityArray(rawActivities)
		? rawActivities
		: undefined;

	const getActivityIcon = (action: string) => {
		switch (action) {
			case "created":
				return <Plus className="w-3.5 h-3.5 text-green-600" />;
			case "updated":
				return <Activity className="w-3.5 h-3.5 text-blue-600" />;
			case "moved":
				return <Move className="w-3.5 h-3.5 text-purple-600" />;
			case "assigned":
				return <UserPlus className="w-3.5 h-3.5 text-blue-600" />;
			case "unassigned":
				return <UserMinus className="w-3.5 h-3.5 text-gray-600" />;
			case "completed":
				return <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />;
			case "reopened":
				return <XCircle className="w-3.5 h-3.5 text-orange-600" />;
			case "commented":
				return <MessageSquare className="w-3.5 h-3.5 text-blue-600" />;
			case "priority_changed":
				return <AlertCircle className="w-3.5 h-3.5 text-orange-600" />;
			case "due_date_changed":
				return <Calendar className="w-3.5 h-3.5 text-purple-600" />;
			case "blocked":
				return <Shield className="w-3.5 h-3.5 text-red-600" />;
			case "unblocked":
				return <Shield className="w-3.5 h-3.5 text-green-600" />;
			default:
				return <Activity className="w-3.5 h-3.5" />;
		}
	};

	const getActivityText = (activity: CardActivity) => {
		let details: {
			subtaskId?: string;
			title?: string;
			blockedByTitle?: string;
		} = {};

		if (activity.details) {
			try {
				details = JSON.parse(activity.details);
			} catch (error) {
				console.warn("Failed to parse card activity details", {
					activityId: activity._id,
					action: activity.action,
					error,
				});
			}
		}

		switch (activity.action) {
			case "created":
				if (details.subtaskId) {
					return `added subtask "${details.title}"`;
				}
				return "created this card";
			case "updated":
				return "updated this card";
			case "moved":
				return "moved this card";
			case "assigned":
				return "assigned this card";
			case "unassigned":
				return "unassigned from this card";
			case "completed":
				return "marked as complete";
			case "reopened":
				return "reopened this card";
			case "commented":
				return "commented";
			case "priority_changed":
				return "changed priority";
			case "due_date_changed":
				return "changed due date";
			case "blocked":
				return `marked as blocked by "${details.blockedByTitle}"`;
			case "unblocked":
				return "removed blocker";
			default:
				return activity.action;
		}
	};

	return (
		<div className="space-y-3">
			{/* Header */}
			<div className="flex items-center gap-2">
				<Activity className="w-4 h-4" />
				<h3 className="text-sm font-semibold">Activity</h3>
				{activities && activities.length > 0 && (
					<span className="text-xs text-muted-foreground">
						({activities.length})
					</span>
				)}
			</div>

			{/* Activity list */}
			<ScrollArea className="h-[300px] rounded-md border p-3">
				{hasInvalidActivityData ? (
					<div className="flex items-center justify-center h-full text-sm text-destructive">
						Unable to render activity: invalid activity data.
					</div>
				) : activities && activities.length > 0 ? (
					<div className="space-y-3">
						{activities.map((activity) => (
							<div className="flex gap-2" key={activity._id}>
								<div className="shrink-0 mt-0.5">
									{getActivityIcon(activity.action)}
								</div>
								<div className="flex-1 space-y-0.5">
									<div className="flex items-center gap-2 flex-wrap">
										<Avatar className="h-5 w-5">
											<AvatarImage
												alt={activity.member.user.name || "User"}
												src={activity.member.user.image}
											/>
											<AvatarFallback className="text-[9px]">
												{activity.member.user.name?.charAt(0).toUpperCase() ||
													"?"}
											</AvatarFallback>
										</Avatar>
										<span className="text-xs font-medium">
											{activity.member.user.name || "Unknown"}
										</span>
										<span className="text-xs text-muted-foreground">
											{getActivityText(activity)}
										</span>
									</div>
									<span className="text-[10px] text-muted-foreground">
										{formatDistanceToNow(new Date(activity.timestamp), {
											addSuffix: true,
										})}
									</span>
								</div>
							</div>
						))}
					</div>
				) : (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						No activity yet
					</div>
				)}
			</ScrollArea>
		</div>
	);
};
