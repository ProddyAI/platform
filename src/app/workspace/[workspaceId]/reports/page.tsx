"use client";

import {
  BarChart,
  Loader,
  PieChart,
  LineChart,
  Search,
  Users,
  Hash,
  Calendar,
  CheckSquare,
  MessageSquare,
  Download,
  FileText,
  Filter,
  Activity,
  Shield,
  ChevronDown,
} from "lucide-react";
import React, { useState, useEffect, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { format, subDays } from "date-fns";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { WorkspaceToolbar } from "../toolbar";
import { exportReportToPDF } from "@/features/reports/utils/pdf-export";
import { toast } from "sonner";

// Import chart components for the Messages and Tasks tabs
import {
  BarChart as BarChartComponent,
  PieChart as PieChartComponent,
  LineChart as LineChartComponent,
  HorizontalBarChart,
} from "@/features/reports/components/charts";

// Import our dashboard components
import {
  UserActivityDashboard,
  ChannelActivityDashboard,
  OverviewDashboard,
  ContentAnalysisDashboard,
  PerformanceMetricsDashboard,
} from "@/features/reports/components";
const ReportsPage = () => {
  // Set document title
  useDocumentTitle("Reports");

  const workspaceId = useWorkspaceId();
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState("");
  const [timeRange, setTimeRange] = useState<"1d" | "7d" | "30d">("7d");
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
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
          variant="ghost"
          className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
          size="sm"
        >
          <BarChart className="mr-2 size-5" />
          <span className="truncate">Reports</span>
        </Button>
      </WorkspaceToolbar>
      <div className="flex flex-1 flex-col bg-white overflow-hidden">
        {/* Header with filters */}
        <div className="border-b border-border/30 bg-white px-4 py-4 flex-shrink-0">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight">Reports & Analytics</h1>
              <p className="text-muted-foreground">
                Track workspace activity and performance metrics
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              {/* Time Range Filter */}
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium">Time Range:</span>
                <div className="flex rounded-md border border-input overflow-hidden">
                  <Button
                    type="button"
                    variant={timeRange === "1d" ? "default" : "ghost"}
                    className="rounded-none border-0"
                    onClick={() => setTimeRange("1d")}
                  >
                    1 day
                  </Button>
                  <Button
                    type="button"
                    variant={timeRange === "7d" ? "default" : "ghost"}
                    className="rounded-none border-0"
                    onClick={() => setTimeRange("7d")}
                  >
                    7 days
                  </Button>
                  <Button
                    type="button"
                    variant={timeRange === "30d" ? "default" : "ghost"}
                    className="rounded-none border-0"
                    onClick={() => setTimeRange("30d")}
                  >
                    30 days
                  </Button>
                </div>
                <div className="flex items-center">
                  <Button
                    variant="outline"
                    onClick={handleExport}
                    disabled={isExporting || isOverviewLoading}
                    className="rounded-r-none border-r-0"
                  >
                    {isExporting ? (
                      <Loader className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Download className="mr-2 h-4 w-4" />
                    )}
                    Export {exportFormat.toUpperCase()}
                  </Button>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        size="sm"
                        className="rounded-l-none px-2"
                        disabled={isExporting || isOverviewLoading}
                      >
                        <ChevronDown className="h-4 w-4" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-40 p-2">
                      <div className="space-y-1">
                        <Button
                          variant={exportFormat === "pdf" ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setExportFormat("pdf")}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          PDF
                        </Button>
                        <Button
                          variant={exportFormat === "json" ? "default" : "ghost"}
                          size="sm"
                          className="w-full justify-start"
                          onClick={() => setExportFormat("json")}
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
        <div className="flex-1 overflow-auto p-4">
          <div className="mx-auto max-w-7xl space-y-6">
            {/* Tabs */}
            <Tabs defaultValue="overview" className="space-y-6">
              <TabsList className="grid w-full grid-cols-7 mb-4">
                <TabsTrigger
                  value="overview"
                  onClick={() => setActiveTab("overview")}
                >
                  <BarChart className="h-4 w-4 mr-2" />
                  Overview
                </TabsTrigger>
                <TabsTrigger
                  value="users"
                  onClick={() => setActiveTab("users")}
                >
                  <Users className="h-4 w-4 mr-2" />
                  Users
                </TabsTrigger>
                <TabsTrigger
                  value="channels"
                  onClick={() => setActiveTab("channels")}
                >
                  <Hash className="h-4 w-4 mr-2" />
                  Channels
                </TabsTrigger>
                <TabsTrigger
                  value="messages"
                  onClick={() => setActiveTab("messages")}
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  Messages
                </TabsTrigger>
                <TabsTrigger
                  value="content"
                  onClick={() => setActiveTab("content")}
                >
                  <FileText className="h-4 w-4 mr-2" />
                  Content
                </TabsTrigger>
                <TabsTrigger
                  value="performance"
                  onClick={() => setActiveTab("performance")}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  Performance
                </TabsTrigger>
                <TabsTrigger
                  value="tasks"
                  onClick={() => setActiveTab("tasks")}
                >
                  <CheckSquare className="h-4 w-4 mr-2" />
                  Tasks
                </TabsTrigger>
              </TabsList>

              {/* Overview Tab */}
              <TabsContent value="overview">
                {workspaceId ? (
                  <OverviewDashboard workspaceId={workspaceId} timeRange={timeRange} />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                )}
              </TabsContent>

              {/* Users Tab */}
              <TabsContent value="users">
                {workspaceId ? (
                  <UserActivityDashboard workspaceId={workspaceId} timeRange={timeRange} />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                )}
              </TabsContent>

              {/* Channels Tab */}
              <TabsContent value="channels">
                {workspaceId ? (
                  <ChannelActivityDashboard workspaceId={workspaceId} timeRange={timeRange} />
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
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Messages
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <MessageSquare className="h-5 w-5 text-secondary mr-2" />
                            <div className="text-2xl font-bold">
                              {messageData?.totalMessages
                                ? messageData.totalMessages.toLocaleString()
                                : 0}
                            </div>
                          </div>
                          <CardDescription>
                            in the selected time period
                          </CardDescription>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Daily Average
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <BarChart className="h-5 w-5 text-secondary mr-2" />
                            <div className="text-2xl font-bold">
                              {messageData.messagesByDate.length > 0
                                ? Math.round(
                                  messageData.totalMessages /
                                  messageData.messagesByDate.length
                                )
                                : 0}
                            </div>
                          </div>
                          <CardDescription>messages per day</CardDescription>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Top Sender
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <Users className="h-5 w-5 text-secondary mr-2" />
                            <div className="text-xl font-bold truncate">
                              {messageData.topSenders.length > 0
                                ? messageData.topSenders[0].name
                                : "No data"}
                            </div>
                          </div>
                          <CardDescription>
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
                              height={300}
                              formatValue={(value) => `${value} messages`}
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
                                color: "bg-secondary",
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
                  <ContentAnalysisDashboard workspaceId={workspaceId} timeRange={timeRange} />
                ) : (
                  <div className="flex items-center justify-center h-64">
                    <Loader className="h-8 w-8 animate-spin text-secondary" />
                  </div>
                )}
              </TabsContent>

              {/* Performance Metrics Tab */}
              <TabsContent value="performance">
                {workspaceId ? (
                  <PerformanceMetricsDashboard workspaceId={workspaceId} timeRange={timeRange} />
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
                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Total Tasks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <CheckSquare className="h-5 w-5 text-secondary mr-2" />
                            <div className="text-2xl font-bold">
                              {taskData.totalTasks}
                            </div>
                          </div>
                          <CardDescription>
                            in the selected time period
                          </CardDescription>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            Completed Tasks
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <CheckSquare className="h-5 w-5 text-green-500 mr-2" />
                            <div className="text-2xl font-bold">
                              {taskData.completedTasks}
                            </div>
                          </div>
                          <CardDescription>
                            {taskData.totalTasks > 0
                              ? `${Math.round((taskData.completedTasks / taskData.totalTasks) * 100)}% completion rate`
                              : "0% completion rate"}
                          </CardDescription>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            In Progress
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <CheckSquare className="h-5 w-5 text-blue-500 mr-2" />
                            <div className="text-2xl font-bold">
                              {taskData.statusCounts.in_progress}
                            </div>
                          </div>
                          <CardDescription>
                            tasks currently in progress
                          </CardDescription>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader className="pb-2">
                          <CardTitle className="text-sm font-medium text-muted-foreground">
                            High Priority
                          </CardTitle>
                        </CardHeader>
                        <CardContent>
                          <div className="flex items-center">
                            <CheckSquare className="h-5 w-5 text-red-500 mr-2" />
                            <div className="text-2xl font-bold">
                              {taskData.priorityCounts.high}
                            </div>
                          </div>
                          <CardDescription>high priority tasks</CardDescription>
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
                              data={[
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
                              ].filter((item) => item.value > 0)}
                              size={450}
                              maxSize={500}
                              formatValue={(value) => `${value} tasks`}
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
                              data={[
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
                              ].filter((item) => item.value > 0)}
                              size={450}
                              maxSize={500}
                              formatValue={(value) => `${value} tasks`}
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
                      <CardContent className="h-80">
                        {taskData.tasksByDate.length > 0 ? (
                          <LineChartComponent
                            data={taskData.tasksByDate.map((item) => ({
                              label: format(new Date(item.date), "MMM dd"),
                              value: item.count,
                            }))}
                            height={300}
                            formatValue={(value) => `${value} tasks`}
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
                                // Generate different colors for each category
                                const colors = [
                                  "bg-secondary",
                                  "bg-secondary",
                                  "bg-primary",
                                  "bg-chart-1",
                                  "bg-chart-2",
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
