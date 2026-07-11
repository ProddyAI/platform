"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import {
	Activity,
	BarChart as BarChartIcon,
	CheckSquare,
	Hash,
	MessageSquare,
	Minus,
	TrendingDown,
	TrendingUp,
	Users,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
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
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import {
	LineChart,
	NEUTRAL_COLOR,
	PieChart,
	STATUS_COLORS,
} from "@/features/reports/components/charts";

const MAX_VISIBLE_ACTIVE_USERS = 8;

const TIME_RANGE_LABEL: Record<"1d" | "7d" | "30d", string> = {
	"1d": "in the last 24 hours",
	"7d": "in the last 7 days",
	"30d": "in the last 30 days",
};

type TrendVisual = {
	Icon: typeof TrendingUp;
	className: string;
	label: string;
};

// Shared trend styling so a positive/negative/flat change always renders the
// same icon and color everywhere it appears, and a 0% change reads as
// neutral rather than a false-positive green "up" arrow.
const getTrendVisual = (change: number): TrendVisual => {
	const label = `${Math.abs(change)}%`;

	if (change > 0) {
		return {
			Icon: TrendingUp,
			className: "text-success",
			label,
		};
	}

	if (change < 0) {
		return {
			Icon: TrendingDown,
			className: "text-destructive",
			label,
		};
	}

	return { Icon: Minus, className: "text-muted-foreground", label };
};

// Keeps the last successfully loaded value on screen while a query is
// refetching (e.g. after switching time range), instead of tearing the
// whole dashboard down to a loading state on every change.
function useStableValue<T>(value: T | undefined): T | undefined {
	const lastValueRef = useRef<T | undefined>(undefined);

	if (value !== undefined) {
		lastValueRef.current = value;
	}

	return lastValueRef.current;
}

interface OverviewDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const OverviewDashboard = ({
	workspaceId,
	timeRange = "7d",
}: OverviewDashboardProps) => {
	// Calculate date ranges based on selected time range. endDate refreshes
	// periodically and whenever the tab regains focus so a long-lived view
	// doesn't go stale.
	const [endDate, setEndDate] = useState(() => Date.now());

	useEffect(() => {
		const refresh = () => setEndDate(Date.now());
		const intervalId = setInterval(refresh, 5 * 60 * 1000);
		window.addEventListener("focus", refresh);
		return () => {
			clearInterval(intervalId);
			window.removeEventListener("focus", refresh);
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

	// Calculate previous period for comparison
	const previousEndDate = useMemo(() => startDate, [startDate]);
	const previousStartDate = useMemo(() => {
		const periodLength = endDate - startDate;
		return startDate - periodLength;
	}, [startDate, endDate]);

	// Fetch current period data
	const overviewData = useQuery(
		api.workspace.analytics.getWorkspaceOverview,
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

	// Fetch previous period data for comparison
	const previousOverviewData = useQuery(
		api.workspace.analytics.getWorkspaceOverview,
		workspaceId
			? {
					workspaceId,
					startDate: previousStartDate,
					endDate: previousEndDate,
				}
			: "skip"
	);

	// Fetch message analytics
	const messageData = useQuery(
		api.workspace.analytics.getMessageAnalytics,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Fetch task analytics
	const taskData = useQuery(
		api.workspace.analytics.getTaskAnalytics,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	const stableOverviewData = useStableValue(overviewData);
	const stableActiveUsersData = useStableValue(activeUsersData);
	const stablePreviousOverviewData = useStableValue(previousOverviewData);
	const stableMessageData = useStableValue(messageData);
	const stableTaskData = useStableValue(taskData);

	const isInitialLoading =
		!stableOverviewData ||
		!stableMessageData ||
		!stableTaskData ||
		!stableActiveUsersData;

	// Calculate trends (percentage change from previous period)
	const trends = useMemo(() => {
		if (!stableOverviewData || !stablePreviousOverviewData) return null;

		const calculateChange = (current: number, previous: number) => {
			if (previous === 0) return current > 0 ? 100 : 0;
			return Math.round(((current - previous) / previous) * 100);
		};

		return {
			activeUsers: calculateChange(
				stableOverviewData.activeUserCount,
				stablePreviousOverviewData.activeUserCount
			),
			messages: calculateChange(
				stableOverviewData.totalMessages,
				stablePreviousOverviewData.totalMessages
			),
			tasks: calculateChange(
				stableOverviewData.totalTasks,
				stablePreviousOverviewData.totalTasks
			),
			completedTasks: calculateChange(
				stableOverviewData.completedTasks,
				stablePreviousOverviewData.completedTasks
			),
		};
	}, [stableOverviewData, stablePreviousOverviewData]);

	const trendVisuals = useMemo(() => {
		if (!trends) return null;

		return {
			activeUsers: getTrendVisual(trends.activeUsers),
			messages: getTrendVisual(trends.messages),
			tasks: getTrendVisual(trends.tasks),
		};
	}, [trends]);

	// Prepare data for activity trend chart
	const activityTrendData = useMemo(() => {
		if (!stableMessageData) return [];

		return stableMessageData.messagesByDate.map((item) => ({
			label: format(new Date(item.date), "MMM dd"),
			value: item.count,
		}));
	}, [stableMessageData]);

	// Prepare data for task completion rate chart
	const taskCompletionData = useMemo(() => {
		if (!stableTaskData) return [];

		const completionRate =
			stableTaskData.totalTasks > 0
				? Math.round(
						(stableTaskData.completedTasks / stableTaskData.totalTasks) * 100
					)
				: 0;

		return [
			{
				label: "Completed",
				value: completionRate,
				color: STATUS_COLORS.completed,
			},
			{
				label: "Remaining",
				value: 100 - completionRate,
				color: NEUTRAL_COLOR,
			},
		];
	}, [stableTaskData]);

	if (isInitialLoading) {
		return (
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<h2 className="text-xl font-semibold text-foreground">
						Workspace Overview
					</h2>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
					{["active-users", "messages", "tasks", "channels"].map((key) => (
						<Card className="border-border" key={key}>
							<CardHeader className="pb-2">
								<Skeleton className="h-4 w-24" />
							</CardHeader>
							<CardContent className="space-y-2">
								<Skeleton className="h-8 w-16" />
								<Skeleton className="h-3 w-32" />
							</CardContent>
						</Card>
					))}
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
					<Card className="flex flex-col">
						<CardHeader className="pb-4 flex-shrink-0">
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-4 w-56 mt-2" />
						</CardHeader>
						<CardContent className="flex-1 p-6 pt-0">
							<Skeleton className="h-[350px] w-full" />
						</CardContent>
					</Card>
					<Card className="flex flex-col">
						<CardHeader className="pb-4 flex-shrink-0">
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-4 w-48 mt-2" />
						</CardHeader>
						<CardContent className="flex-1 p-4 pt-0 pb-4">
							<Skeleton className="h-[350px] w-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	if (!stableOverviewData) {
		return (
			<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
				<BarChartIcon className="h-12 w-12 text-muted-foreground mb-2" />
				<h3 className="text-lg font-medium">No Overview Data</h3>
				<p className="text-sm text-muted-foreground">
					There is no data available for the selected time period.
				</p>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold text-foreground">
					Workspace Overview
				</h2>
			</div>

			{/* Key Metrics with Trends */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<TooltipProvider>
					<Tooltip>
						<TooltipTrigger asChild>
							<Card className="cursor-help border-border" tabIndex={0}>
								<CardHeader className="pb-2">
									<CardTitle className="text-sm font-medium text-muted-foreground/90">
										Active Users
									</CardTitle>
								</CardHeader>
								<CardContent>
									<div className="flex items-center justify-between">
										<div className="flex items-center">
											<Users className="h-5 w-5 text-secondary mr-2" />
											<div className="text-2xl font-bold text-foreground">
												{stableActiveUsersData?.activeUserCount || 0}
											</div>
										</div>
										{trendVisuals && (
											<div
												className={`flex items-center text-sm font-medium ${trendVisuals.activeUsers.className}`}
											>
												<trendVisuals.activeUsers.Icon className="h-4 w-4 mr-1" />
												{trendVisuals.activeUsers.label}
											</div>
										)}
									</div>
									<CardDescription className="text-muted-foreground/80">
										{stableActiveUsersData?.activeUserPercentage || 0}% of{" "}
										{stableActiveUsersData?.totalMembers || 0} total users
									</CardDescription>
								</CardContent>
							</Card>
						</TooltipTrigger>
						<TooltipContent className="max-w-xs" side="top">
							<div className="space-y-1">
								<p className="font-medium text-sm">Active Users:</p>
								{stableActiveUsersData?.activeUsers &&
								stableActiveUsersData.activeUsers.length > 0 ? (
									<div className="space-y-1">
										{stableActiveUsersData.activeUsers
											.slice(0, MAX_VISIBLE_ACTIVE_USERS)
											.map((user) => (
												<div className="text-xs" key={user.memberId}>
													• {user.name}
												</div>
											))}
										{stableActiveUsersData.activeUsers.length >
											MAX_VISIBLE_ACTIVE_USERS && (
											<div className="text-xs text-muted-foreground">
												and{" "}
												{stableActiveUsersData.activeUsers.length -
													MAX_VISIBLE_ACTIVE_USERS}{" "}
												more
											</div>
										)}
									</div>
								) : (
									<p className="text-xs text-muted-foreground">
										No active users
									</p>
								)}
							</div>
						</TooltipContent>
					</Tooltip>
				</TooltipProvider>

				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Total Messages
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="flex items-center">
								<MessageSquare className="h-5 w-5 text-secondary mr-2" />
								<div className="text-2xl font-bold text-foreground">
									{stableOverviewData.totalMessages
										? stableOverviewData.totalMessages.toLocaleString()
										: 0}
								</div>
							</div>
							{trendVisuals && (
								<div
									className={`flex items-center text-sm font-medium ${trendVisuals.messages.className}`}
								>
									<trendVisuals.messages.Icon className="h-4 w-4 mr-1" />
									{trendVisuals.messages.label}
								</div>
							)}
						</div>
						<CardDescription className="text-muted-foreground/80">
							{stableOverviewData.activeUserCount > 0
								? `${Math.round(stableOverviewData.totalMessages / stableOverviewData.activeUserCount)} per active user`
								: "No active users"}{" "}
							{TIME_RANGE_LABEL[timeRange]}
						</CardDescription>
					</CardContent>
				</Card>

				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Tasks Created
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center justify-between">
							<div className="flex items-center">
								<CheckSquare className="h-5 w-5 text-secondary mr-2" />
								<div className="text-2xl font-bold text-foreground">
									{stableOverviewData.totalTasks}
								</div>
							</div>
							{trendVisuals && (
								<div
									className={`flex items-center text-sm font-medium ${trendVisuals.tasks.className}`}
								>
									<trendVisuals.tasks.Icon className="h-4 w-4 mr-1" />
									{trendVisuals.tasks.label}
								</div>
							)}
						</div>
						<CardDescription className="text-muted-foreground/80">
							{stableTaskData && stableTaskData.completedTasks > 0
								? `${Math.round((stableTaskData.completedTasks / stableTaskData.totalTasks) * 100)}% completion rate`
								: "0% completion rate"}
						</CardDescription>
					</CardContent>
				</Card>

				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Active Channels
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Hash className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold text-foreground">
								{stableOverviewData.totalChannels}
							</div>
						</div>
						<CardDescription className="text-muted-foreground/80">
							{stableOverviewData.totalMessages > 0 &&
							stableOverviewData.totalChannels > 0
								? `${Math.round(stableOverviewData.totalMessages / stableOverviewData.totalChannels)} messages per channel`
								: "No messages"}
						</CardDescription>
					</CardContent>
				</Card>
			</div>

			{/* Activity Trends and Task Completion */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				{/* Activity Trend Card */}
				<Card className="flex flex-col">
					<CardHeader className="pb-4 flex-shrink-0">
						<CardTitle className="flex items-center gap-2">
							<Activity className="h-5 w-5 text-secondary" />
							Activity Trend
						</CardTitle>
						<CardDescription>
							Daily message activity over the selected time period
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 flex flex-col p-6 pt-0 min-h-0">
						{activityTrendData.length > 0 ? (
							<div className="flex-1 flex items-center justify-center h-[400px] max-h-[400px] overflow-hidden">
								<LineChart
									className="w-full h-full"
									data={activityTrendData}
									formatValue={(value) => `${value} messages`}
									height={350}
								/>
							</div>
						) : (
							<div className="flex-1 flex items-center justify-center h-[400px]">
								<div className="text-center p-8 bg-muted/20 rounded-lg w-full">
									<Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-medium text-muted-foreground mb-2">
										No activity data available
									</h3>
									<p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
										Messages will appear here once users start chatting in this
										workspace
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>

				{/* Task Completion Card */}
				<Card className="flex flex-col">
					<CardHeader className="pb-4 flex-shrink-0">
						<CardTitle className="flex items-center gap-2">
							<CheckSquare className="h-5 w-5 text-secondary" />
							Task Completion
						</CardTitle>
						<CardDescription>
							Overall task completion rate and progress
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 flex flex-col p-4 pt-0 pb-4 min-h-0">
						{taskCompletionData.length > 0 && stableTaskData ? (
							<div className="flex-1 flex flex-col items-center h-[400px] max-h-[400px] space-y-2 pt-4">
								{/* Pie Chart */}
								<div className="relative flex-shrink-0 h-[280px] w-full">
									<PieChart
										data={taskCompletionData}
										formatValue={(value) => `${value}%`}
									/>
								</div>

								{/* Task Statistics */}
								<div className="w-full space-y-2 px-2">
									<div className="grid grid-cols-2 gap-2">
										<div className="text-center p-2 bg-chart-2/10 dark:bg-chart-2/20 rounded-lg border border-chart-2/30">
											<div className="text-xl font-bold text-foreground">
												{stableTaskData.completedTasks}
											</div>
											<div className="text-xs text-muted-foreground">
												Completed
											</div>
										</div>
										<div className="text-center p-2 bg-muted/40 rounded-lg border border-muted-foreground/20">
											<div className="text-xl font-bold text-foreground">
												{stableTaskData.totalTasks -
													stableTaskData.completedTasks}
											</div>
											<div className="text-xs text-muted-foreground">
												Remaining
											</div>
										</div>
									</div>

									{/* Progress Bar */}
									<div className="w-full">
										<div className="flex justify-between text-xs text-muted-foreground mb-1">
											<span>Progress</span>
											<span className="font-medium">
												{stableTaskData.completedTasks}/
												{stableTaskData.totalTasks} tasks
											</span>
										</div>
										<div className="w-full bg-muted rounded-full h-1.5">
											<div
												className="bg-chart-2 h-1.5 rounded-full transition-all duration-500"
												style={{
													width: `${stableTaskData.totalTasks > 0 ? (stableTaskData.completedTasks / stableTaskData.totalTasks) * 100 : 0}%`,
												}}
											/>
										</div>
									</div>
								</div>
							</div>
						) : (
							<div className="flex-1 flex items-center justify-center h-[400px]">
								<div className="text-center p-8 bg-muted/20 rounded-lg w-full">
									<CheckSquare className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
									<h3 className="text-lg font-medium text-muted-foreground mb-2">
										No task data available
									</h3>
									<p className="text-sm text-muted-foreground/70 max-w-sm mx-auto">
										Tasks will appear here once they are created in this
										workspace
									</p>
								</div>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
