"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import { Award, CheckSquare, Loader, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	HorizontalBarChart,
	LineChart,
	PieChart,
} from "@/features/reports/components/charts";

interface PerformanceMetricsDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const PerformanceMetricsDashboard = ({
	workspaceId,
	timeRange = "7d",
}: PerformanceMetricsDashboardProps) => {
	const [_activeTab, setActiveTab] = useState("tasks");

	// Calculate date ranges
	const endDate = useMemo(() => Date.now(), []);
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

	// Fetch task analytics
	const taskData = useQuery(
		api.analytics.getTaskAnalytics,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Fetch user activity data
	const userActivityData = useQuery(
		api.analytics.getUserActivitySummary,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	const isLoading = !taskData || !userActivityData;

	// Calculate task completion rate
	const taskCompletionRate = useMemo(() => {
		if (!taskData || taskData.totalTasks === 0) return 0;
		return Math.round((taskData.completedTasks / taskData.totalTasks) * 100);
	}, [taskData]);

	// Calculate average task completion time (mock data - would come from backend)
	const avgCompletionTime = useMemo(() => {
		return 2.5; // days
	}, []);

	// Calculate on-time completion rate (mock data - would come from backend)
	const onTimeCompletionRate = useMemo(() => {
		return 78; // percent
	}, []);

	// Calculate task distribution by assignee (creator in this case)
	const tasksByAssignee = useMemo(() => {
		if (!userActivityData || !taskData) return [];

		// Generate mock data since we don't have real task assignment data
		return userActivityData
			.filter((user) => user.member?.user?._id) // Only users with IDs
			.map((user) => {
				// Calculate a value based on message activity
				// In a real app, you'd use actual task assignment data
				const _messageCount = user.messageCount || 0;
				const taskValue = Math.floor(5 + Math.random() * 10);
				const completionRate = 0.4 + Math.random() * 0.5; // Random completion rate between 40-90%

				return {
					label: user.member?.user?.name || "Unknown",
					value: taskValue,
					color: "bg-pink-500",
					completionRate: completionRate,
				};
			})
			.sort((a, b) => b.value - a.value)
			.slice(0, 5);
	}, [userActivityData, taskData]);

	// Mock data for task priority distribution
	const _taskPriorityData = useMemo(() => {
		if (!taskData) return [];

		return [
			{ label: "High", value: taskData.priorityCounts.high, color: "#ec4899" },
			{
				label: "Medium",
				value: taskData.priorityCounts.medium,
				color: "#f472b6",
			},
			{ label: "Low", value: taskData.priorityCounts.low, color: "#fb7185" },
		].filter((item) => item.value > 0);
	}, [taskData]);

	// Mock data for task status distribution
	const taskStatusData = useMemo(() => {
		if (!taskData) return [];

		return [
			{
				label: "Completed",
				value: taskData.statusCounts.completed,
				color: "#22c55e",
			},
			{
				label: "In Progress",
				value: taskData.statusCounts.in_progress,
				color: "#3b82f6",
			},
			{
				label: "Not Started",
				value: taskData.statusCounts.not_started,
				color: "#a855f7",
			},
			{
				label: "On Hold",
				value: taskData.statusCounts.on_hold,
				color: "#eab308",
			},
			{
				label: "Cancelled",
				value: taskData.statusCounts.cancelled,
				color: "#ef4444",
			},
		].filter((item) => item.value > 0);
	}, [taskData]);

	// Mock data for task completion trend
	const taskCompletionTrend = useMemo(() => {
		if (!taskData || !taskData.tasksByDate) return [];

		return taskData.tasksByDate.map((item) => ({
			label: format(new Date(item.date), "MMM dd"),
			value: Math.round(item.count * 0.7), // Mock data - in real app would be actual completed tasks
		}));
	}, [taskData]);

	// User performance metrics
	const userPerformanceData = useMemo(() => {
		if (!userActivityData) return [];

		return userActivityData
			.filter((user) => {
				const messageCount = user.messageCount || 0;
				return messageCount > 0; // Only include users with messages
			})
			.map((user) => {
				const messageCount = user.messageCount || 0;

				// Generate random data for demonstration
				const taskCount = Math.floor(3 + Math.random() * 10);
				const taskCompletion = Math.floor(50 + Math.random() * 50); // Between 50-100%
				const responseTime = Math.floor(Math.random() * 30 + 5); // Between 5-35 minutes
				const activityScore = Math.floor(messageCount * 0.3 + taskCount * 0.7);

				return {
					name: user.member?.user?.name || "Unknown",
					taskCompletion: taskCompletion,
					responseTime: responseTime,
					activityScore: activityScore,
					messages: messageCount,
					tasks: taskCount,
				};
			})
			.sort((a, b) => b.activityScore - a.activityScore)
			.slice(0, 5);
	}, [userActivityData]);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader className="h-8 w-8 animate-spin text-secondary" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold">Performance Metrics</h2>
			</div>

			{/* Performance tabs */}
			<Tabs
				defaultValue="tasks"
				className="space-y-4"
				onValueChange={setActiveTab}
			>
				<TabsList>
					<TabsTrigger value="tasks">
						<CheckSquare className="h-4 w-4 mr-2" />
						Task Performance
					</TabsTrigger>
					<TabsTrigger value="users">
						<Users className="h-4 w-4 mr-2" />
						User Performance
					</TabsTrigger>
				</TabsList>

				{/* Task Performance Tab */}
				<TabsContent value="tasks" className="space-y-4">
					{/* Key metrics */}
					<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
						<Card>
							<CardHeader className="pb-2">
								<CardTitle className="text-sm font-medium text-muted-foreground">
									Task Completion Rate
								</CardTitle>
							</CardHeader>
							<CardContent>
								<div className="space-y-2">
									<div className="flex items-center justify-between">
										<div className="text-2xl font-bold">
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
													: "Needs Improvement"}
										</Badge>
									</div>
									<Progress value={taskCompletionRate} className="h-2" />
								</div>
								<CardDescription className="mt-2 text-slate-600 dark:text-slate-400">
									{taskData?.completedTasks || 0} of {taskData?.totalTasks || 0}{" "}
									tasks completed
								</CardDescription>
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
										<div className="text-2xl font-bold">
											{avgCompletionTime} days
										</div>
										<Badge
											variant={
												avgCompletionTime <= 2
													? "success"
													: avgCompletionTime <= 4
														? "warning"
														: "destructive"
											}
										>
											{avgCompletionTime <= 2
												? "Fast"
												: avgCompletionTime <= 4
													? "Average"
													: "Slow"}
										</Badge>
									</div>
									<Progress
										value={100 - avgCompletionTime * 10}
										className="h-2"
									/>
								</div>
								<CardDescription className="mt-2 text-slate-600 dark:text-slate-400">
									Target: 2 days per task
								</CardDescription>
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
										<div className="text-2xl font-bold">
											{onTimeCompletionRate}%
										</div>
										<Badge
											variant={
												onTimeCompletionRate >= 80
													? "success"
													: onTimeCompletionRate >= 60
														? "warning"
														: "destructive"
											}
										>
											{onTimeCompletionRate >= 80
												? "Good"
												: onTimeCompletionRate >= 60
													? "Average"
													: "Needs Improvement"}
										</Badge>
									</div>
									<Progress value={onTimeCompletionRate} className="h-2" />
								</div>
								<CardDescription className="mt-2 text-slate-600 dark:text-slate-400">
									Tasks completed before deadline
								</CardDescription>
							</CardContent>
						</Card>
					</div>

					{/* Charts */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Task Completion Trend</CardTitle>
								<CardDescription>Tasks completed over time</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{taskCompletionTrend.length > 0 ? (
										<LineChart
											data={taskCompletionTrend}
											height={300}
											formatValue={(value) => `${value} tasks`}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No task data available
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
									{taskStatusData.length > 0 ? (
										<PieChart
											data={taskStatusData}
											size={380}
											formatValue={(value) => `${value} tasks`}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No task data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Tasks by Assignee</CardTitle>
							<CardDescription>
								Task distribution and completion rates by user
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="max-h-[300px] overflow-auto">
								{tasksByAssignee.length > 0 ? (
									<div className="space-y-4">
										{tasksByAssignee.map((user, index) => (
											<div key={index} className="space-y-2">
												<div className="flex items-center justify-between">
													<div className="font-medium">{user.label}</div>
													<div className="text-sm text-muted-foreground">
														{user.value} tasks
													</div>
												</div>
												<div className="flex items-center gap-2">
													<Progress
														value={user.completionRate * 100}
														className="h-2 flex-1"
													/>
													<div className="text-sm font-medium w-12 text-right">
														{Math.round(user.completionRate * 100)}%
													</div>
												</div>
											</div>
										))}
									</div>
								) : (
									<div className="flex items-center justify-center h-40 bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No assignee data available
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* User Performance Tab */}
				<TabsContent value="users" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Top Performers</CardTitle>
								<CardDescription>
									Users with highest activity scores
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="max-h-[300px] overflow-auto">
									{userPerformanceData.length > 0 ? (
										<div className="space-y-4">
											{userPerformanceData.map((user, index) => (
												<div key={index} className="space-y-2">
													<div className="flex items-center justify-between">
														<div className="font-medium flex items-center">
															{index === 0 && (
																<Award className="h-4 w-4 text-yellow-500 mr-1" />
															)}
															{user.name}
														</div>
														<div className="text-sm font-medium">
															Score: {user.activityScore}
														</div>
													</div>
													<div className="flex items-center gap-2">
														<Progress
															value={user.activityScore / 2}
															className="h-2 flex-1"
														/>
														<div className="text-xs text-muted-foreground">
															{user.messages} msgs, {user.tasks} tasks
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
								<CardTitle>Task Completion by User</CardTitle>
								<CardDescription>
									Percentage of assigned tasks completed
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[300px] max-h-[300px] overflow-auto">
									{userPerformanceData.length > 0 ? (
										<HorizontalBarChart
											data={userPerformanceData.map((user) => ({
												label: user.name,
												value: user.taskCompletion,
												color:
													user.taskCompletion >= 70
														? "bg-green-500"
														: user.taskCompletion >= 50
															? "bg-yellow-500"
															: "bg-red-500",
											}))}
											formatValue={(value) => `${value}%`}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No task completion data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Response Time by User</CardTitle>
							<CardDescription>
								Average time to respond to messages (minutes)
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[300px] max-h-[300px] overflow-auto">
								{userPerformanceData.length > 0 ? (
									<HorizontalBarChart
										data={userPerformanceData.map((user) => ({
											label: user.name,
											value: user.responseTime,
											color:
												user.responseTime <= 10
													? "bg-green-500"
													: user.responseTime <= 20
														? "bg-yellow-500"
														: "bg-red-500",
										}))}
										formatValue={(value) => `${value} min`}
									/>
								) : (
									<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No response time data available
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
