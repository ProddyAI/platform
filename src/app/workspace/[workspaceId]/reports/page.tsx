"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import {
	Activity,
	BarChart,
	ChevronDown,
	Download,
	FileText,
	Hash,
	Loader,
	Shield,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
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
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { exportReportToPDF } from "@/features/reports/utils/pdf-export";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const TAB_TRIGGER_CLASS = "text-xs md:text-sm px-2 md:px-3";

const ReportsPage = () => {
	// Set document title
	useDocumentTitle("Reports");

	useSetWorkspaceTitle(<WorkspaceTitle icon={BarChart} label="Reports" />);

	const workspaceId = useWorkspaceId();
	const router = useRouter();
	const [_searchQuery, _setSearchQuery] = useState("");
	const [timeRange, setTimeRange] = useState<"1d" | "7d" | "30d">("7d");
	const [isExporting, setIsExporting] = useState(false);
	const [_activeTab, setActiveTab] = useState("overview");
	const [exportFormat, setExportFormat] = useState<"json" | "pdf">("pdf");

	// Get current member to check permissions
	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId: workspaceId as Id<"workspaces">,
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
		workspaceId: workspaceId ?? null,
		activityType: "reports_page_view",
	});

	// Fetch workspace overview data
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
	const isOverviewLoading = overviewData === undefined;

	// Fetch message and task analytics for the export payload. The dashboards
	// below fetch and render this same data themselves, so the reports page no
	// longer needs its own loading flags for these — only handleExport reads
	// the raw values.
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

	// Check if user has permission to access this page
	const isUnauthorizedMember =
		!memberLoading && member && member.role === "member";

	// Redirect to workspace home if user is not an admin or owner
	useEffect(() => {
		if (isUnauthorizedMember) {
			router.push(`/workspace/${workspaceId}`);
		}
	}, [isUnauthorizedMember, router, workspaceId]);

	if (isUnauthorizedMember) {
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
					You don&apos;t have permission to access this page.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-1 flex-col bg-background overflow-hidden">
			{/* Header with filters */}
			<div className="border-b border-border bg-card px-4 py-4 flex-shrink-0">
				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<div>
						<h1 className="text-2xl font-semibold tracking-tight text-foreground">
							Reports & Analytics
						</h1>
						<p className="text-muted-foreground">
							Track workspace activity and performance metrics
						</p>
					</div>
					<div className="flex flex-col gap-2 sm:flex-row sm:items-center">
						{/* Time Range Filter */}
						<div className="flex items-center gap-2 flex-wrap">
							<span className="text-xs md:text-sm font-medium text-foreground">
								Time Range:
							</span>
							<div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
								<Button
									className="rounded-full text-xs md:text-sm px-2 md:px-4"
									onClick={() => setTimeRange("1d")}
									size="sm"
									type="button"
									variant={timeRange === "1d" ? "default" : "ghost"}
								>
									1 day
								</Button>
								<Button
									className="rounded-full text-xs md:text-sm px-2 md:px-4"
									onClick={() => setTimeRange("7d")}
									size="sm"
									type="button"
									variant={timeRange === "7d" ? "default" : "ghost"}
								>
									7 days
								</Button>
								<Button
									className="rounded-full text-xs md:text-sm px-2 md:px-4"
									onClick={() => setTimeRange("30d")}
									size="sm"
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
									<span className="hidden sm:inline">
										Export {exportFormat.toUpperCase()}
									</span>
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
												variant={exportFormat === "json" ? "default" : "ghost"}
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
					{/* Tabs — consolidated from 7 tabs (Overview / Users / Channels /
						    Messages / Content / Performance / Tasks) down to 4. The
						    standalone Messages and Tasks tabs were folded into Content and
						    Performance respectively: their charts duplicated what those
						    dashboards' own sub-tabs already rendered from the same
						    queries, and the handful of stats/charts that weren't
						    duplicates (Daily Average, Top Sender, Total Tasks, In
						    Progress, High Priority, Task Priority Distribution, the full
						    Tasks-by-Category list) were relocated into those dashboards
						    instead of being dropped. Users and Channels — two related
						    "who's active, where" views — were merged into a single People
						    tab with nested sub-tabs. */}
					<Tabs className="space-y-4 md:space-y-6" defaultValue="overview">
						<div className="overflow-x-auto -mx-2 md:mx-0">
							<TabsList className="grid grid-cols-4 min-w-max md:w-full mb-3 md:mb-4 bg-muted/30">
								<TabsTrigger
									aria-label="Overview"
									className={TAB_TRIGGER_CLASS}
									onClick={() => setActiveTab("overview")}
									value="overview"
								>
									<BarChart className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
									<span className="hidden md:inline">Overview</span>
								</TabsTrigger>
								<TabsTrigger
									aria-label="People"
									className={TAB_TRIGGER_CLASS}
									onClick={() => setActiveTab("people")}
									value="people"
								>
									<Users className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
									<span className="hidden md:inline">People</span>
								</TabsTrigger>
								<TabsTrigger
									aria-label="Content"
									className={TAB_TRIGGER_CLASS}
									onClick={() => setActiveTab("content")}
									value="content"
								>
									<FileText className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
									<span className="hidden md:inline">Content</span>
								</TabsTrigger>
								<TabsTrigger
									aria-label="Performance"
									className={TAB_TRIGGER_CLASS}
									onClick={() => setActiveTab("performance")}
									value="performance"
								>
									<Activity className="h-3 w-3 md:h-4 md:w-4 md:mr-2" />
									<span className="hidden md:inline">Performance</span>
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
									<Loader className="h-8 w-8 animate-spin text-primary" />
								</div>
							)}
						</TabsContent>

						{/* People Tab — merges the old standalone Users and Channels
							    tabs behind nested sub-tabs. */}
						<TabsContent value="people">
							{workspaceId ? (
								<Tabs className="space-y-4" defaultValue="users">
									<TabsList>
										<TabsTrigger value="users">
											<Users className="h-4 w-4 mr-2" />
											Users
										</TabsTrigger>
										<TabsTrigger value="channels">
											<Hash className="h-4 w-4 mr-2" />
											Channels
										</TabsTrigger>
									</TabsList>

									<TabsContent value="users">
										<UserActivityDashboard
											timeRange={timeRange}
											workspaceId={workspaceId}
										/>
									</TabsContent>

									<TabsContent value="channels">
										<ChannelActivityDashboard
											timeRange={timeRange}
											workspaceId={workspaceId}
										/>
									</TabsContent>
								</Tabs>
							) : (
								<div className="flex items-center justify-center h-64">
									<Loader className="h-8 w-8 animate-spin text-primary" />
								</div>
							)}
						</TabsContent>

						{/* Content Tab — absorbs the old standalone Messages tab; see
							    ContentAnalysisDashboard's Messages sub-tab. */}
						<TabsContent value="content">
							{workspaceId ? (
								<ContentAnalysisDashboard
									timeRange={timeRange}
									workspaceId={workspaceId}
								/>
							) : (
								<div className="flex items-center justify-center h-64">
									<Loader className="h-8 w-8 animate-spin text-primary" />
								</div>
							)}
						</TabsContent>

						{/* Performance Tab — absorbs the old standalone Tasks tab; see
							    PerformanceMetricsDashboard's Task Performance sub-tab. */}
						<TabsContent value="performance">
							{workspaceId ? (
								<PerformanceMetricsDashboard
									timeRange={timeRange}
									workspaceId={workspaceId}
								/>
							) : (
								<div className="flex items-center justify-center h-64">
									<Loader className="h-8 w-8 animate-spin text-primary" />
								</div>
							)}
						</TabsContent>
					</Tabs>
				</div>
			</div>
		</div>
	);
};

export default ReportsPage;
