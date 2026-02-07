"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import {
	Activity,
	BarChart,
	CheckSquare,
	ChevronDown,
	Download,
	FileText,
	Hash,
	Loader,
	MessageSquare,
	Shield,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCurrentMember } from "@/features/members/api/use-current-member";
// Import our dashboard components
import {
	ChannelActivityDashboard,
	ContentAnalysisDashboard,
	OverviewDashboard,
	PerformanceMetricsDashboard,
	UserActivityDashboard,
} from "@/features/reports/components";
// Import chart components for the Messages and Tasks tabs
import {
	HorizontalBarChart,
	LineChart as LineChartComponent,
	PieChart as PieChartComponent,
} from "@/features/reports/components/charts";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { exportReportToPDF } from "@/features/reports/utils/pdf-export";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

const ReportsPage = () => {
	// Set document title
	useDocumentTitle("Reports");

	const workspaceId = useWorkspaceId();
	const router = useRouter();
	const [_searchQuery, _setSearchQuery] = useState("");
	const [timeRange, setTimeRange] = useState<"1d" | "7d" | "30d">("7d");
	const [isExporting, setIsExporting] = useState(false);
	const [_activeTab, setActiveTab] = useState("overview");
	const [exportFormat, setExportFormat] = useState<"json" | "pdf">("pdf");

	// Get current member to check permissions
	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});

	// Calculate date range based on selected time range
	const endDate = useMemo(() => Date.now(), []); // Only calculate once on component mount
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

	// Track page view
	useTrackActivity({
		workspaceId,
		activityType: "reports_page_view",
	});

	// Fetch workspace overview data
	const overviewData = useQuery(
		api.analytics.getWorkspaceOverview,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);
	const isOverviewLoading = overviewData === undefined;

	// Fetch message analytics data
	const messageData = useQuery(
		api.analytics.getMessageAnalytics,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);
	const isMessageLoading = messageData === undefined;

	// Fetch task analytics data
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
	const isTaskLoading = taskData === undefined;

	// Check if user has permission to access this page
	if (!memberLoading && member && member.role === "member") {
		// Redirect to workspace home if user is not an admin or owner
		router.push(`/workspace/${workspaceId}`);
		return null;
	}

	// Handle export
	const handleExport = async () => {
		if (!overviewData) return;

		setIsExporting(true);

		try {
			// Create export data
			const exportData = {
				generatedAt: new Date().toISOString(),
				timeRange,
				overview: overviewData,
				messages: messageData,
				tasks: taskData,
			};

			if (exportFormat === "pdf") {
				// Export as PDF
				await exportReportToPDF(exportData);
				toast.success("Report exported as PDF successfully!");
			} else {
				// Export as JSON
				const jsonData = JSON.stringify(exportData, null, 2);
				const blob = new Blob([jsonData], { type: "application/json" });
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.href = url;
				link.download = `reports-export-${format(new Date(), "yyyy-MM-dd")}.json`;
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				URL.revokeObjectURL(url);
				toast.success("Report exported as JSON successfully!");
			}
		} catch (error) {
			console.error("Failed to export data:", error);
			toast.error("Failed to export report. Please try again.");
		} finally {
			setIsExporting(false);
		}
	};

	// We don't need to prepare chart data here as we're using the dashboard components

	// Show loading state while checking permissions
	if (memberLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="h-8 w-8 animate-spin text-primary" />
			</div>
		);
	}

	// Show access denied if no member data
	if (!member) {
		return (
			<div className="flex h-full flex-col items-center justify-center">
				<Shield className="h-12 w-12 text-muted-foreground mb-4" />
				<h2 className="text-2xl font-bold">Access Denied</h2>
				<p className="text-muted-foreground">
					You don't have permission to access this page.
				</p>
			</div>
		);
	}

	return (
		<>
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
				>
					<BarChart className="mr-2 size-5" />
					<span className="truncate">Reports</span>
				</Button>
			</WorkspaceToolbar>
			<div className="flex flex-1 flex-col bg-background overflow-hidden">
				{/* Header with filters */}
				<div className="border-b border-border bg-card px-4 py-4 flex-shrink-0">
					<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
						<div>
							<h1 className="text-2xl font-bold tracking-tight text-foreground">
								Reports & Analytics
							</h1>
							<p className="text-muted-foreground/90">
								Track workspace activity and performance metrics
							</p>
						</div>
						<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
							{/* Time Range Filter */}
							<div className="flex items-center gap-2 flex-wrap">
								<span className="text-xs md:text-sm font-medium text-foreground">
									Time Range:
								</span>
								<div className="flex rounded-md border border-input bg-background overflow-hidden">
									<Button
										className="rounded-none border-0 text-xs md:text-sm px-2 md:px-4"
										onClick={() => setTimeRange("1d")}
										type="button"
										variant={timeRange === "1d" ? "default" : "ghost"}
									>
										1 day
									</Button>
									<Button
										className="rounded-none border-0 text-xs md:text-sm px-2 md:px-4"
										onClick={() => setTimeRange("7d")}
										type="button"
										variant={timeRange === "7d" ? "default" : "ghost"}
									>
										7 days
									</Button>
									<Button
										className="rounded-none border-0 text-xs md:text-sm px-2 md:px-4"
										onClick={() => setTimeRange("30d")}
										type="button"
										variant={timeRange === "30d" ? "default" : "ghost"}
									>
										30 days
									</Button>
								</div>
								<div className="flex items-center">
									<Button
										className="rounded-r-none border-r-0 text-xs md:text-sm"
										disabled={isExporting || isOverviewLoading}
										onClick={handleExport}
										size="sm"
										variant="outline"
									>
										{isExporting ? (
											<Loader className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4 animate-spin" />
										) : (
											<Download className="mr-1 md:mr-2 h-3 w-3 md:h-4 md:w-4" />
										)}
										<span className="hidden sm:inline">Export {exportFormat.toUpperCase()}</span>
										<span className="sm:hidden">Export</span>
									</Button>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												className="rounded-l-none px-2"
												disabled={isExporting || isOverviewLoading}
												size="sm"
												variant="outline"
											>
												<ChevronDown className="h-4 w-4" />
											</Button>
										</PopoverTrigger>
										<PopoverContent className="w-40 p-2">
											<div className="space-y-1">
												<Button
													className="w-full justify-start"
													onClick={() => setExportFormat("pdf")}
													size="sm"
													variant={exportFormat === "pdf" ? "default" : "ghost"}
												>
													<FileText className="mr-2 h-4 w-4" />
													PDF
												</Button>
												<Button
													className="w-full justify-start"
													onClick={() => setExportFormat("json")}
													size="sm"
													variant={
														exportFormat === "json" ? "default" : "ghost"
													}
												>
													<Download className="mr-2 h-4 w-4" />
													JSON
												</Button>
											</div>
										</PopoverContent>
									</Popover>
								</div>
							</div>
						</div>
					</div>
				</div>

				{/* Main content area */}
				<div className="flex-1 overflow-auto p-2 md:p-4 bg-background">
					<div className="mx-auto max-w-7xl space-y-4 md:space-y-6">
						{/* Tabs */}
						<Tabs className="space-y-4 md:space-y-6" defaultValue="overview">
							<div className="overflow-x-auto -mx-2 md:mx-0">
								<TabsList className="grid grid-cols-7 min-w-max md:w-full mb-3 md:mb-4 bg-muted/30">
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("overview")}
										value="overview"
									>
										<BarChart className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Overview</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("users")}
										value="users"
									>
										<Users className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Users</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("channels")}
										value="channels"
									>
										<Hash className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Channels</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("messages")}
										value="messages"
									>
										<MessageSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Messages</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("content")}
										value="content"
									>
										<FileText className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Content</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("performance")}
										value="performance"
									>
										<Activity className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Performance</span>
									</TabsTrigger>
									<TabsTrigger
										className="data-[state=active]:bg-pink-500/20 data-[state=active]:border-2 data-[state=active]:border-pink-500 data-[state=active]:text-pink-500 text-xs md:text-sm px-2 md:px-3"
										onClick={() => setActiveTab("tasks")}
										value="tasks"
									>
										<CheckSquare className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
										<span className="hidden md:inline">Tasks</span>
									</TabsTrigger>
								</TabsList>
							</div>

							{/* Overview Tab */}
							<TabsContent value="overview">
								{workspaceId ? (
									<OverviewDashboard
										timeRange={timeRange}
										workspaceId={workspaceId}
									/>
								) : (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								)}
							</TabsContent>

							{/* Users Tab */}
							<TabsContent value="users">
								{workspaceId ? (
									<UserActivityDashboard
										timeRange={timeRange}
										workspaceId={workspaceId}
									/>
								) : (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								)}
							</TabsContent>

							{/* Channels Tab */}
							<TabsContent value="channels">
								{workspaceId ? (
									<ChannelActivityDashboard
										timeRange={timeRange}
										workspaceId={workspaceId}
									/>
								) : (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								)}
							</TabsContent>

							{/* Messages Tab */}
							<TabsContent value="messages">
								{isMessageLoading ? (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								) : messageData && messageData.totalMessages !== undefined ? (
									<div className="space-y-6">
										{/* Message stats */}
										<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														Total Messages
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<MessageSquare className="h-5 w-5 text-secondary mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{messageData?.totalMessages
																? messageData.totalMessages.toLocaleString()
																: 0}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														in the selected time period
													</CardDescription>
												</CardContent>
											</Card>

											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														Daily Average
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<BarChart className="h-5 w-5 text-secondary mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{messageData.messagesByDate.length > 0
																? Math.round(
																		messageData.totalMessages /
																			messageData.messagesByDate.length
																	)
																: 0}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														messages per day
													</CardDescription>
												</CardContent>
											</Card>

											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														Top Sender
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<Users className="h-5 w-5 text-secondary mr-2" />
														<div className="text-xl font-bold truncate text-foreground">
															{messageData.topSenders.length > 0
																? messageData.topSenders[0].name
																: "No data"}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														{messageData.topSenders.length > 0
															? `${messageData.topSenders[0].count} messages`
															: ""}
													</CardDescription>
												</CardContent>
											</Card>
										</div>

										{/* Message charts */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<Card>
												<CardHeader>
													<CardTitle>Messages Over Time</CardTitle>
													<CardDescription>Daily message count</CardDescription>
												</CardHeader>
												<CardContent className="h-80">
													{messageData.messagesByDate.length > 0 ? (
														<LineChartComponent
															data={messageData.messagesByDate.map((item) => ({
																label: format(new Date(item.date), "MMM dd"),
																value: item.count,
															}))}
															formatValue={(value) => `${value} messages`}
															height={300}
														/>
													) : (
														<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
															<p className="text-muted-foreground">
																No message data available
															</p>
														</div>
													)}
												</CardContent>
											</Card>

											<Card>
												<CardHeader>
													<CardTitle>Top Message Senders</CardTitle>
													<CardDescription>
														Users with most messages
													</CardDescription>
												</CardHeader>
												<CardContent>
													{messageData.topSenders.length > 0 ? (
														<HorizontalBarChart
															data={messageData.topSenders.map((sender) => ({
																label: sender.name,
																value: sender.count,
																color: "bg-pink-500",
															}))}
															formatValue={(value) => `${value} messages`}
														/>
													) : (
														<div className="flex items-center justify-center h-64 bg-muted/20 rounded-md">
															<p className="text-muted-foreground">
																No sender data available
															</p>
														</div>
													)}
												</CardContent>
											</Card>
										</div>
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
										<MessageSquare className="h-12 w-12 text-muted-foreground mb-2" />
										<h3 className="text-lg font-medium">No Message Data</h3>
										<p className="text-sm text-muted-foreground">
											There is no message data available for the selected time
											period.
										</p>
									</div>
								)}
							</TabsContent>

							{/* Content Analysis Tab */}
							<TabsContent value="content">
								{workspaceId ? (
									<ContentAnalysisDashboard
										timeRange={timeRange}
										workspaceId={workspaceId}
									/>
								) : (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								)}
							</TabsContent>

							{/* Performance Metrics Tab */}
							<TabsContent value="performance">
								{workspaceId ? (
									<PerformanceMetricsDashboard
										timeRange={timeRange}
										workspaceId={workspaceId}
									/>
								) : (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								)}
							</TabsContent>

							{/* Tasks Tab */}
							<TabsContent value="tasks">
								{isTaskLoading ? (
									<div className="flex items-center justify-center h-64">
										<Loader className="h-8 w-8 animate-spin text-secondary" />
									</div>
								) : taskData && taskData.totalTasks !== undefined ? (
									<div className="space-y-6">
										{/* Task stats */}
										<div className="grid grid-cols-1 md:grid-cols-4 gap-4">
											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														Total Tasks
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<CheckSquare className="h-5 w-5 text-secondary mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{taskData.totalTasks}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														in the selected time period
													</CardDescription>
												</CardContent>
											</Card>

											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														Completed Tasks
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<CheckSquare className="h-5 w-5 text-green-500 mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{taskData.completedTasks}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														{taskData.totalTasks > 0
															? `${Math.round((taskData.completedTasks / taskData.totalTasks) * 100)}% completion rate`
															: "0% completion rate"}
													</CardDescription>
												</CardContent>
											</Card>

											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														In Progress
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<CheckSquare className="h-5 w-5 text-blue-500 mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{taskData.statusCounts.in_progress}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														tasks currently in progress
													</CardDescription>
												</CardContent>
											</Card>

											<Card className="border-border">
												<CardHeader className="pb-2">
													<CardTitle className="text-sm font-medium text-muted-foreground/90">
														High Priority
													</CardTitle>
												</CardHeader>
												<CardContent>
													<div className="flex items-center">
														<CheckSquare className="h-5 w-5 text-red-500 mr-2" />
														<div className="text-2xl font-bold text-foreground">
															{taskData.priorityCounts.high}
														</div>
													</div>
													<CardDescription className="text-muted-foreground/80">
														high priority tasks
													</CardDescription>
												</CardContent>
											</Card>
										</div>

										{/* Task charts */}
										<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
											<Card className="flex flex-col">
												<CardHeader>
													<CardTitle>Task Status Distribution</CardTitle>
													<CardDescription>
														Tasks by current status
													</CardDescription>
												</CardHeader>
												<CardContent className="flex-1 min-h-0 p-4">
													<div className="h-[450px] w-full overflow-visible">
														<PieChartComponent
															data={
																taskData.totalTasks > 0
																	? [
																			{
																				label: "Completed",
																				value: taskData.statusCounts.completed,
																				color: "#22c55e",
																			},
																			{
																				label: "In Progress",
																				value:
																					taskData.statusCounts.in_progress,
																				color: "#3b82f6",
																			},
																			{
																				label: "Not Started",
																				value:
																					taskData.statusCounts.not_started,
																				color: "#6b7280",
																			},
																			{
																				label: "On Hold",
																				value: taskData.statusCounts.on_hold,
																				color: "#f59e0b",
																			},
																			{
																				label: "Cancelled",
																				value: taskData.statusCounts.cancelled,
																				color: "#ef4444",
																			},
																		].filter((item) => item.value > 0)
																	: [
																			{
																				label: "No Data Available",
																				value: 100,
																				color: "#6b7280",
																			},
																		]
															}
															formatValue={(value) =>
																taskData.totalTasks > 0 ? `${value} tasks` : ""
															}
															maxSize={500}
															size={450}
														/>
													</div>
												</CardContent>
											</Card>

											<Card className="flex flex-col">
												<CardHeader>
													<CardTitle>Task Priority Distribution</CardTitle>
													<CardDescription>
														Tasks by priority level
													</CardDescription>
												</CardHeader>
												<CardContent className="flex-1 min-h-0 p-4">
													<div className="h-[450px] w-full overflow-visible">
														<PieChartComponent
															data={
																taskData.totalTasks > 0
																	? [
																			{
																				label: "High",
																				value: taskData.priorityCounts.high,
																				color: "#ef4444",
																			},
																			{
																				label: "Medium",
																				value: taskData.priorityCounts.medium,
																				color: "#f59e0b",
																			},
																			{
																				label: "Low",
																				value: taskData.priorityCounts.low,
																				color: "#22c55e",
																			},
																		].filter((item) => item.value > 0)
																	: [
																			{
																				label: "No Data Available",
																				value: 100,
																				color: "#6b7280",
																			},
																		]
															}
															formatValue={(value) =>
																taskData.totalTasks > 0 ? `${value} tasks` : ""
															}
															maxSize={500}
															size={450}
														/>
													</div>
												</CardContent>
											</Card>
										</div>

										<Card>
											<CardHeader>
												<CardTitle>Tasks Created Over Time</CardTitle>
												<CardDescription>Daily task creation</CardDescription>
											</CardHeader>
											<CardContent className="h-96">
												{taskData.tasksByDate.length > 0 ? (
													<LineChartComponent
														data={taskData.tasksByDate.map((item) => ({
															label: format(new Date(item.date), "MMM dd"),
															value: item.count,
														}))}
														formatValue={(value) => `${value} tasks`}
														height={350}
													/>
												) : (
													<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
														<p className="text-muted-foreground">
															No task creation data available
														</p>
													</div>
												)}
											</CardContent>
										</Card>

										{taskData.categoryData.length > 0 && (
											<Card>
												<CardHeader>
													<CardTitle>Tasks by Category</CardTitle>
													<CardDescription>
														Distribution of tasks across categories
													</CardDescription>
												</CardHeader>
												<CardContent>
													<HorizontalBarChart
														data={taskData.categoryData.map(
															(category, index) => {
																// Generate different solid colors for each category
																const colors = [
																	"bg-purple-600",
																	"bg-pink-600",
																	"bg-blue-600",
																	"bg-teal-600",
																	"bg-orange-600",
																	"bg-green-600",
																	"bg-indigo-600",
																	"bg-rose-600",
																];
																return {
																	label: category.name,
																	value: category.count,
																	color: colors[index % colors.length],
																};
															}
														)}
														formatValue={(value) => `${value} tasks`}
													/>
												</CardContent>
											</Card>
										)}
									</div>
								) : (
									<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
										<CheckSquare className="h-12 w-12 text-muted-foreground mb-2" />
										<h3 className="text-lg font-medium">No Task Data</h3>
										<p className="text-sm text-muted-foreground">
											There is no task data available for the selected time
											period.
										</p>
									</div>
								)}
							</TabsContent>
						</Tabs>
					</div>
				</div>
			</div>
		</>
	);
};

export default ReportsPage;
