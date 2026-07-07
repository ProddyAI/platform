"use client";

import { useQuery } from "convex/react";
import { subDays } from "date-fns";
import { Clock, Loader, MessageSquare, ThumbsUp, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
	HorizontalBarChart,
	INTENSITY_COLOR_CLASSES,
} from "@/features/reports/components/charts";
import { formatDuration } from "@/features/reports/utils/format-duration";

// Time threshold constants for activity color coding. totalTimeSpent is in
// milliseconds (see schema.ts channelSessions.duration), matching the unit
// formatDuration() expects, so these thresholds must be milliseconds too.
const ONE_HOUR_IN_MS = 60 * 60 * 1000;
const FIFTEEN_MINUTES_IN_MS = 15 * 60 * 1000;

// How often to nudge the range's end forward so a long-lived session doesn't
// keep comparing against the moment the dashboard first mounted.
const END_DATE_REFRESH_INTERVAL_MS = 60 * 1000;

interface UserActivityDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const UserActivityDashboard = ({
	workspaceId,
	timeRange = "7d",
}: UserActivityDashboardProps) => {
	// Calculate date range based on selected time range
	const [endDate, setEndDate] = useState(() => Date.now());

	// Keep the end of the range current instead of freezing it at mount time:
	// refresh periodically and whenever the tab regains focus.
	useEffect(() => {
		const refresh = () => setEndDate(Date.now());
		const interval = setInterval(refresh, END_DATE_REFRESH_INTERVAL_MS);
		const handleVisibility = () => {
			if (document.visibilityState === "visible") refresh();
		};
		document.addEventListener("visibilitychange", handleVisibility);
		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", handleVisibility);
		};
	}, []);

	const startDate = useMemo(() => {
		switch (timeRange) {
			case "1d":
				return subDays(endDate, 1).getTime();
			case "7d":
				return subDays(endDate, 7).getTime();
			case "30d":
				return subDays(endDate, 30).getTime();
			default:
				return subDays(endDate, 7).getTime();
		}
	}, [timeRange, endDate]);

	// Fetch user activity data
	const userActivityResult = useQuery(
		api.workspace.analytics.getUserActivitySummary,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Fetch current active users count for the selected time period
	const activeUsersData = useQuery(
		api.workspace.analytics.getActiveUsersCount,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Keep the last successfully loaded data visible while a new range is
	// fetched, instead of tearing down the whole view on every toggle.
	const [cachedActivity, setCachedActivity] = useState(userActivityResult);
	const [cachedActiveUsers, setCachedActiveUsers] = useState(activeUsersData);

	useEffect(() => {
		if (userActivityResult !== undefined) {
			setCachedActivity(userActivityResult);
		}
	}, [userActivityResult]);

	useEffect(() => {
		if (activeUsersData !== undefined) {
			setCachedActiveUsers(activeUsersData);
		}
	}, [activeUsersData]);

	const resolvedActivity = userActivityResult ?? cachedActivity;
	const resolvedActiveUsers = activeUsersData ?? cachedActiveUsers;

	const isInitialLoading =
		resolvedActivity === undefined || resolvedActiveUsers === undefined;
	const isRefetching =
		!isInitialLoading &&
		(userActivityResult === undefined || activeUsersData === undefined);

	const userActivity = resolvedActivity || [];

	if (isInitialLoading) {
		return (
			<div aria-busy="true" aria-live="polite" className="space-y-6">
				<div className="flex justify-between items-center">
					<h2 className="text-xl font-semibold">User Activity</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{Array.from({ length: 4 }).map((_, index) => (
						<Card key={`kpi-skeleton-${index}`}>
							<CardHeader className="pb-2">
								<Skeleton className="h-4 w-24" />
							</CardHeader>
							<CardContent>
								<Skeleton className="h-8 w-20 mb-2" />
								<Skeleton className="h-3 w-32" />
							</CardContent>
						</Card>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					{Array.from({ length: 2 }).map((_, index) => (
						<Card className="flex flex-col" key={`chart-skeleton-${index}`}>
							<CardHeader>
								<Skeleton className="h-5 w-40 mb-2" />
								<Skeleton className="h-4 w-56" />
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<Skeleton className="h-[400px] max-h-[400px] w-full" />
							</CardContent>
						</Card>
					))}
				</div>
			</div>
		);
	}

	if (userActivity.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
				<Users className="h-12 w-12 text-muted-foreground mb-2" />
				<h3 className="text-lg font-medium">No user activity data</h3>
				<p className="text-sm text-muted-foreground">
					Start interacting with the platform to generate activity data.
				</p>
			</div>
		);
	}

	// Sort users by message count
	const sortedByMessages = [...userActivity].sort(
		(a, b) => b.messageCount - a.messageCount
	);

	// Sort users by time spent
	const sortedByTimeSpent = [...userActivity].sort((a, b) => {
		const timeA = a.totalTimeSpent || 0;
		const timeB = b.totalTimeSpent || 0;
		return timeB - timeA;
	});

	// Prepare data for charts
	const messageCountData = sortedByMessages.slice(0, 10).map((item) => ({
		label: item.member?.user?.name || "Unknown",
		value: item.messageCount,
		color: "bg-secondary",
	}));

	const timeSpentData = sortedByTimeSpent
		.filter((item) => (item.totalTimeSpent || 0) > 0) // Only show users with time spent
		.slice(0, 10)
		.map((item) => {
			const timeValue = item.totalTimeSpent || 0;

			// Single-hue sequential scale (intensity via opacity) rather than
			// mixing unrelated semantic colors for "engagement".
			const color =
				timeValue > ONE_HOUR_IN_MS
					? INTENSITY_COLOR_CLASSES.high
					: timeValue > FIFTEEN_MINUTES_IN_MS
						? INTENSITY_COLOR_CLASSES.medium
						: INTENSITY_COLOR_CLASSES.low;

			return {
				label: item.member?.user?.name || "Unknown",
				value: timeValue,
				color,
			};
		});

	// Calculate total stats
	const totalMessages = userActivity.reduce(
		(sum, item) => sum + item.messageCount,
		0
	);
	const totalReactions = userActivity.reduce(
		(sum, item) => sum + item.reactionCount,
		0
	);
	const totalTimeSpent = userActivity.reduce(
		(sum, item) => sum + item.totalTimeSpent,
		0
	);

	// Use current active users count from dedicated query (currently logged in users)
	const activeUsers = resolvedActiveUsers?.activeUserCount || 0;
	const totalMembers = resolvedActiveUsers?.totalMembers || userActivity.length;
	const activeUserPercentage = resolvedActiveUsers?.activeUserPercentage || 0;

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold">User Activity</h2>
				{isRefetching && (
					<span
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						role="status"
					>
						<Loader aria-hidden="true" className="h-3 w-3 animate-spin" />
						Updating…
					</span>
				)}
			</div>

			{/* Stats overview */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Active Users
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Users className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold">{activeUsers}</div>
						</div>
						<CardDescription>
							{activeUserPercentage}% of {totalMembers} total users
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Messages
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<MessageSquare className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold">{totalMessages}</div>
						</div>
						<CardDescription>
							{totalMembers > 0
								? (totalMessages / totalMembers).toFixed(1)
								: "0"}{" "}
							per user
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Reactions
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<ThumbsUp className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold">{totalReactions}</div>
						</div>
						<CardDescription>
							{totalMembers > 0
								? (totalReactions / totalMembers).toFixed(1)
								: "0"}{" "}
							per user
						</CardDescription>
					</CardContent>
				</Card>

				<Card>
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground">
							Total Time Spent
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Clock className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold">
								{formatDuration(totalTimeSpent, "short")}
							</div>
						</div>
						<CardDescription>
							{activeUsers > 0
								? formatDuration(totalTimeSpent / activeUsers, "short")
								: "0s"}{" "}
							per active user
						</CardDescription>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Messages by User</CardTitle>
						<CardDescription>
							Top 10 users by message count in the selected period
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] overflow-auto">
							<HorizontalBarChart
								data={messageCountData}
								formatValue={(value) => `${value} messages`}
								height={30}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Time Spent by User</CardTitle>
						<CardDescription>
							Top 10 users by time spent in the selected period
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] overflow-auto">
							{timeSpentData.length > 0 ? (
								<HorizontalBarChart
									data={timeSpentData}
									formatValue={(value) => formatDuration(value, "short")}
									height={30}
								/>
							) : (
								<div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-md">
									<Clock className="h-12 w-12 text-muted-foreground mb-2" />
									<p className="text-muted-foreground text-sm">
										No time tracking data available
									</p>
									<p className="text-muted-foreground/70 text-xs mt-1">
										Time spent data will appear as users interact with the
										workspace
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
