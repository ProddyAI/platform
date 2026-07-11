"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import { Award, CheckSquare, Loader, Users } from "lucide-react";
import { useMemo, useRef } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { AnimatedNumber } from "@/components/animated-number";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	HorizontalBarChart,
	LineChart,
	NEUTRAL_COLOR,
	PieChart,
	PRIORITY_COLORS,
	PRIORITY_LABELS,
	STATUS_COLORS,
	STATUS_LABELS,
	seriesColorClass,
} from "@/features/reports/components/charts";

interface PerformanceMetricsDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const PerformanceMetricsDashboard = ({
	workspaceId,
	timeRange = "7d",
}: PerformanceMetricsDashboardProps) => {
	// Calculate date ranges. Recompute "now" whenever the range changes so
	// switching 1d/7d/30d doesn't keep querying against a timestamp frozen at
	// mount.
	const { startDate, endDate } = useMemo(() => {
		const now = Date.now();
		switch (timeRange) {
			case "1d":
				return { startDate: subDays(now, 1).getTime(), endDate: now };
			case "30d":
				return { startDate: subDays(now, 30).getTime(), endDate: now };
			default:
				return { startDate: subDays(now, 7).getTime(), endDate: now };
		}
	}, [timeRange]);

	// Fetch task analytics
	const rawTaskData = useQuery(
		api.workspace.analytics.getTaskAnalytics,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Fetch user activity data
	const rawUserActivityData = useQuery(
		api.workspace.analytics.getUserActivitySummary,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Keep the last successful result on screen while a time-range change is
	// refetching, instead of blanking the whole dashboard back to a spinner.
	const taskDataRef = useRef(rawTaskData);
	if (rawTaskData !== undefined) taskDataRef.current = rawTaskData;
	const taskData = taskDataRef.current;

	const userActivityDataRef = useRef(rawUserActivityData);
	if (rawUserActivityData !== undefined) {
		userActivityDataRef.current = rawUserActivityData;
	}
	const userActivityData = userActivityDataRef.current;

	const isLoading = taskData === undefined || userActivityData === undefined;
	const isRefreshing =
		!isLoading &&
		(rawTaskData === undefined || rawUserActivityData === undefined);

	// Check if we have actual task data
	const hasTaskData = useMemo(() => {
		return taskData && taskData.totalTasks > 0;
	}, [taskData]);

	// Check if we have actual user activity data
	const hasUserData = useMemo(() => {
		return userActivityData && userActivityData.length > 0;
	}, [userActivityData]);

	// Calculate task completion rate
	const taskCompletionRate = useMemo(() => {
		if (!taskData || taskData.totalTasks === 0) return 0;
		return Math.round((taskData.completedTasks / taskData.totalTasks) * 100);
	}, [taskData]);

	// Task distribution by category (real data already returned by the
	// analytics query; there is no per-assignee breakdown available yet).
	// Shows every category (not just the top 5) so this can absorb the
	// "Tasks by Category" chart that used to live in the reports page's
	// standalone Tasks tab without dropping any category from the list.
	const tasksByCategory = useMemo(() => {
		if (!taskData || !hasTaskData) return [];

		return taskData.categoryData.map((category) => ({
			label: category.name,
			value: category.count,
			share: taskData.totalTasks > 0 ? category.count / taskData.totalTasks : 0,
		}));
	}, [taskData, hasTaskData]);

	// Task status distribution
	const taskStatusData = useMemo(() => {
		if (!taskData || !hasTaskData) return [];

		return [
			{
				label: STATUS_LABELS.completed,
				value: taskData.statusCounts.completed,
				color: STATUS_COLORS.completed,
			},
			{
				label: STATUS_LABELS.in_progress,
				value: taskData.statusCounts.in_progress,
				color: STATUS_COLORS.in_progress,
			},
			{
				label: STATUS_LABELS.not_started,
				value: taskData.statusCounts.not_started,
				color: STATUS_COLORS.not_started,
			},
			{
				label: STATUS_LABELS.on_hold,
				value: taskData.statusCounts.on_hold,
				color: STATUS_COLORS.on_hold,
			},
			{
				label: STATUS_LABELS.cancelled,
				value: taskData.statusCounts.cancelled,
				color: STATUS_COLORS.cancelled,
			},
		].filter((item) => item.value > 0);
	}, [taskData, hasTaskData]);

	// Task priority distribution — relocated here from the reports page's old
	// standalone Tasks tab, which duplicated the rest of this dashboard's task
	// charts but was the only place priority breakdown was shown.
	const taskPriorityData = useMemo(() => {
		if (!taskData || !hasTaskData) return [];

		return [
			{
				label: PRIORITY_LABELS.high,
				value: taskData.priorityCounts.high,
				color: PRIORITY_COLORS.high,
			},
			{
				label: PRIORITY_LABELS.medium,
				value: taskData.priorityCounts.medium,
				color: PRIORITY_COLORS.medium,
			},
			{
				label: PRIORITY_LABELS.low,
				value: taskData.priorityCounts.low,
				color: PRIORITY_COLORS.low,
			},
		].filter((item) => item.value > 0);
	}, [taskData, hasTaskData]);

	// Tasks created per day (real data). The backend doesn't track a separate
	// completion date, so this reflects creation volume, not completions.
	const tasksCreatedTrend = useMemo(() => {
		if (!taskData?.tasksByDate || !hasTaskData) return [];

		return taskData.tasksByDate.map((item) => ({
			label: format(new Date(item.date), "MMM dd"),
			value: item.count,
		}));
	}, [taskData, hasTaskData]);

	// User performance, derived only from activity the backend actually
	// tracks (messages, reactions, time spent in channels).
	const userPerformanceData = useMemo(() => {
		if (!userActivityData || !hasUserData) return [];

		return userActivityData
			.filter((user) => {
				return (user.messageCount || 0) > 0 || (user.reactionCount || 0) > 0;
			})
			.map((user) => {
				const messages = user.messageCount || 0;
				const reactions = user.reactionCount || 0;

				return {
					name: user.member?.user?.name || "Unknown",
					messages,
					reactions,
					timeSpentMinutes: Math.round((user.totalTimeSpent || 0) / 60000),
					activityScore: messages + reactions,
				};
			})
			.sort((a, b) => b.activityScore - a.activityScore)
			.slice(0, 5);
	}, [userActivityData, hasUserData]);

	const maxActivityScore = useMemo(() => {
		return userPerformanceData.reduce(
			(max, user) => Math.max(max, user.activityScore),
			0
		);
	}, [userPerformanceData]);

	if (isLoading) {
		return (
			<div className="space-y-6">
				<div className="flex justify-between items-center">
					<h2 className="text-xl font-semibold">Performance Metrics</h2>
				</div>
				<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
					{/* Fixed-size loading placeholders with no underlying data — index is a safe key here */}
					{Array.from({ length: 3 }).map((_, index) => (
						<Card key={index}>
							<CardHeader className="pb-2">
								<Skeleton className="h-4 w-32" />
							</CardHeader>
							<CardContent className="space-y-3">
								<Skeleton className="h-7 w-20" />
								<Skeleton className="h-2 w-full" />
							</CardContent>
						</Card>
					))}
				</div>
				<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-52 mt-1" />
						</CardHeader>
						<CardContent>
							<Skeleton className="h-[300px] w-full" />
						</CardContent>
					</Card>
					<Card>
						<CardHeader>
							<Skeleton className="h-5 w-40" />
							<Skeleton className="h-4 w-52 mt-1" />
						</CardHeader>
						<CardContent className="flex items-center justify-center">
							<Skeleton className="size-[300px] rounded-full" />
						</CardContent>
					</Card>
				</div>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold">Performance Metrics</h2>
				{isRefreshing && (
					<span
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						role="status"
					>
						<Loader aria-hidden="true" className="size-3 animate-spin" />
						Updating…
					</span>
				)}
			</div>

			{/* Performance tabs */}
			<Tabs className="space-y-4" defaultValue="tasks">
				<TabsList>
					<TabsTrigger value="tasks">
						<CheckSquare className="size-4 mr-2" />
						Task Performance
					</TabsTrigger>
					<TabsTrigger value="users">
						<Users className="size-4 mr-2" />
						User Performance
					</TabsTrigger>
				</TabsList>

				{/* Task Performance Tab */}
				<TabsContent className="space-y-4" value="tasks">
					{/* Volume metrics — relocated from the reports page's old standalone
					    Tasks tab; "Completed Tasks" isn't repeated here since the Task
					    Completion Rate card below already covers that same metric. Plain
					    tiles rather than StatCard: none of these have a previous-period
					    comparison, and StatCard's caption only renders alongside a delta
					    chip. */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<CheckSquare className="size-4" />
								Total Tasks
							</div>
							<div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
								<AnimatedNumber value={taskData?.totalTasks ?? 0} />
							</div>
							<div className="mt-2 text-xs text-muted-foreground">
								in the selected time period
							</div>
						</Card>

						<Card className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<CheckSquare
									className="size-4"
									style={{ color: STATUS_COLORS.in_progress }}
								/>
								In Progress
							</div>
							<div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
								<AnimatedNumber
									value={taskData?.statusCounts.in_progress ?? 0}
								/>
							</div>
							<div className="mt-2 text-xs text-muted-foreground">
								tasks currently in progress
							</div>
						</Card>

						<Card className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<CheckSquare
									className="size-4"
									style={{ color: PRIORITY_COLORS.high }}
								/>
								High Priority
							</div>
							<div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
								<AnimatedNumber value={taskData?.priorityCounts.high ?? 0} />
							</div>
							<div className="mt-2 text-xs text-muted-foreground">
								high priority tasks
							</div>
						</Card>
					</div>

					{/* Key metrics */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Task Completion Rate
								</CardTitle>
							</CardHeader>
							<CardContent>
								{hasTaskData ? (
									<>
										<div className="space-y-2">
											<div className="flex items-center justify-between">
												<div className="text-3xl font-semibold tracking-tight tabular-nums">
													{taskCompletionRate}%
												</div>
												<Badge
													variant={
														taskCompletionRate >= 70
															? "success"
															: taskCompletionRate >= 50
																? "warning"
																: "destructive"
													}
												>
													{taskCompletionRate >= 70
														? "Good"
														: taskCompletionRate >= 50
															? "Average"
															: "Needs improvement"}
												</Badge>
											</div>
											<Progress className="h-2" value={taskCompletionRate} />
										</div>
										<CardDescription className="mt-2">
											{taskData?.completedTasks || 0} of{" "}
											{taskData?.totalTasks || 0} tasks completed
										</CardDescription>
									</>
								) : (
									<div className="space-y-2">
										<div className="flex items-center justify-between">
											<div className="text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground">
												0%
											</div>
											<Badge variant="outline">No data yet</Badge>
										</div>
										<Progress className="h-2" value={0} />
										<CardDescription className="mt-2">
											0 of 0 tasks completed
										</CardDescription>
									</div>
								)}
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Avg. Completion Time
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground">
											—
										</div>
										<Badge variant="outline">Not tracked yet</Badge>
									</div>
									<CardDescription className="mt-2">
										Add due dates to tasks to unlock this metric
									</CardDescription>
								</div>
							</CardContent>
						</Card>

						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									On-Time Completion
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="text-3xl font-semibold tracking-tight tabular-nums text-muted-foreground">
											—
										</div>
										<Badge variant="outline">Not tracked yet</Badge>
									</div>
									<CardDescription className="mt-2">
										Add task deadlines to unlock this metric
									</CardDescription>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Charts */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Tasks Created Over Time</CardTitle>
								<CardDescription>New tasks created per day</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{hasTaskData && tasksCreatedTrend.length > 0 ? (
										<LineChart
											data={tasksCreatedTrend}
											formatValue={(value) => `${value} tasks`}
											height={300}
										/>
									) : (
										<div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-md">
											<CheckSquare className="size-12 text-muted-foreground mb-2" />
											<p className="text-muted-foreground text-sm">
												No task data available
											</p>
											<p className="text-muted-foreground text-xs mt-1">
												Create tasks to see how volume trends over time
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Task Status Distribution</CardTitle>
								<CardDescription>Current status of all tasks</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[400px] max-h-[400px] flex items-center justify-center overflow-auto">
									<PieChart
										data={
											hasTaskData && taskStatusData.length > 0
												? taskStatusData
												: [
														{
															label: "No data available",
															value: 100,
															color: NEUTRAL_COLOR,
														},
													]
										}
										formatValue={(value) =>
											hasTaskData && taskStatusData.length > 0
												? `${value} tasks`
												: ""
										}
										size={380}
									/>
								</div>
							</CardContent>
						</Card>
					</div>

					{/* Relocated from the reports page's old standalone Tasks tab —
					    priority breakdown wasn't shown anywhere else in this dashboard. */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Task Priority Distribution</CardTitle>
								<CardDescription>Tasks by priority level</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[400px] max-h-[400px] flex items-center justify-center overflow-auto">
									<PieChart
										data={
											hasTaskData && taskPriorityData.length > 0
												? taskPriorityData
												: [
														{
															label: "No data available",
															value: 100,
															color: NEUTRAL_COLOR,
														},
													]
										}
										formatValue={(value) =>
											hasTaskData && taskPriorityData.length > 0
												? `${value} tasks`
												: ""
										}
										size={380}
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Tasks by Category</CardTitle>
								<CardDescription>
									Share of tasks in each category
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="max-h-[400px] overflow-auto">
									{hasTaskData && tasksByCategory.length > 0 ? (
										<div className="space-y-4">
											{tasksByCategory.map((category, index) => (
												<div
													className="space-y-2"
													key={`${category.label}-${index}`}
												>
													<div className="flex items-center justify-between">
														<div className="flex items-center gap-2 font-medium">
															<span
																className={`size-2.5 rounded-full ${seriesColorClass(index)}`}
															/>
															{category.label}
														</div>
														<div className="text-sm text-muted-foreground">
															{category.value} tasks
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Progress
															className="h-2 flex-1"
															value={category.share * 100}
														/>
														<div className="text-sm font-medium w-12 text-right">
															{Math.round(category.share * 100)}%
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="flex flex-col items-center justify-center h-40 bg-muted/20 rounded-md">
											<CheckSquare className="size-10 text-muted-foreground mb-2" />
											<p className="text-muted-foreground text-sm">
												No category data available
											</p>
											<p className="text-muted-foreground text-xs mt-1">
												Categorize tasks to see distribution
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>
				</TabsContent>

				{/* User Performance Tab */}
				<TabsContent className="space-y-4" value="users">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Top Performers</CardTitle>
								<CardDescription>
									Users with the highest message and reaction activity
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="max-h-[300px] overflow-auto">
									{userPerformanceData.length > 0 ? (
										<div className="space-y-4">
											{userPerformanceData.map((user, index) => (
												<div
													className="space-y-2"
													key={`${user.name}-${index}`}
												>
													<div className="flex items-center justify-between">
														<div className="font-medium flex items-center">
															{index === 0 && (
																<Award className="size-4 text-warning mr-1" />
															)}
															{user.name}
														</div>
														<div className="text-sm font-medium">
															Score: {user.activityScore}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Progress
															className="h-2 flex-1"
															value={
																maxActivityScore > 0
																	? (user.activityScore / maxActivityScore) *
																		100
																	: 0
															}
														/>
														<div className="text-xs text-muted-foreground">
															{user.messages} msgs, {user.reactions} reactions
														</div>
													</div>
												</div>
											))}
										</div>
									) : (
										<div className="flex items-center justify-center h-64 bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No user performance data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Time in Channels by User</CardTitle>
								<CardDescription>
									Total time active in channels (minutes)
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[300px] max-h-[300px] overflow-auto">
									{userPerformanceData.length > 0 ? (
										<HorizontalBarChart
											data={userPerformanceData.map((user) => ({
												label: user.name,
												value: user.timeSpentMinutes,
											}))}
											formatValue={(value) => `${value} min`}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No time-in-channel data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Reactions by User</CardTitle>
							<CardDescription>
								Reactions given during this period
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[300px] max-h-[300px] overflow-auto">
								{userPerformanceData.length > 0 ? (
									<HorizontalBarChart
										data={userPerformanceData.map((user) => ({
											label: user.name,
											value: user.reactions,
										}))}
										formatValue={(value) => `${value} reactions`}
									/>
								) : (
									<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No reaction data available
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
};
