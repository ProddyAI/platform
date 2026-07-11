"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import { Calendar, FileText, Loader, MessageSquare, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { AnimatedNumber } from "@/components/animated-number";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BarChart,
	HorizontalBarChart,
	INTENSITY_COLORS,
	LineChart,
	PieChart,
	seriesColor,
} from "@/features/reports/components/charts";

// How often to nudge the range's end forward so a long-lived session doesn't
// keep comparing against the moment the dashboard first mounted.
const END_DATE_REFRESH_INTERVAL_MS = 60 * 1000;

// Semantic color mapping so the same concept (e.g. "Images") renders in the
// same color everywhere it appears across dashboards, consuming the shared
// chart-series palette instead of a one-off local mapping.
const CONTENT_TYPE_COLORS = {
	text: seriesColor(0),
	images: seriesColor(1),
	files: seriesColor(2),
	links: seriesColor(3),
	code: seriesColor(4),
} as const;

// Message length is a single magnitude, not distinct categories, so it uses
// one hue at increasing opacity (the shared intensity scale) rather than
// unrelated colors.
const MESSAGE_LENGTH_COLORS = {
	short: INTENSITY_COLORS.low,
	medium: INTENSITY_COLORS.medium,
	long: INTENSITY_COLORS.high,
} as const;

interface ContentAnalysisDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const ContentAnalysisDashboard = ({
	workspaceId,
	timeRange = "7d",
}: ContentAnalysisDashboardProps) => {
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

	// Fetch content analysis data
	const contentAnalysisData = useQuery(
		api.workspace.analytics.getContentAnalysis,
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
	const [cachedMessageData, setCachedMessageData] = useState(messageData);
	const [cachedContentAnalysisData, setCachedContentAnalysisData] =
		useState(contentAnalysisData);

	useEffect(() => {
		if (messageData !== undefined) {
			setCachedMessageData(messageData);
		}
	}, [messageData]);

	useEffect(() => {
		if (contentAnalysisData !== undefined) {
			setCachedContentAnalysisData(contentAnalysisData);
		}
	}, [contentAnalysisData]);

	const resolvedMessageData = messageData ?? cachedMessageData;
	const resolvedContentAnalysisData =
		contentAnalysisData ?? cachedContentAnalysisData;

	const isInitialLoading =
		resolvedMessageData === undefined ||
		resolvedContentAnalysisData === undefined;
	const isRefetching =
		!isInitialLoading &&
		(messageData === undefined || contentAnalysisData === undefined);

	// Check if we have actual message data
	const hasMessageData = useMemo(() => {
		return (
			resolvedContentAnalysisData &&
			resolvedContentAnalysisData.totalMessages > 0
		);
	}, [resolvedContentAnalysisData]);

	// Prepare content type data from real data
	const contentTypeData = useMemo(() => {
		if (!resolvedContentAnalysisData || !hasMessageData) return [];

		const { contentTypes } = resolvedContentAnalysisData;
		return [
			{
				label: "Text",
				value: contentTypes.text,
				color: CONTENT_TYPE_COLORS.text,
			},
			{
				label: "Images",
				value: contentTypes.images,
				color: CONTENT_TYPE_COLORS.images,
			},
			{
				label: "Files",
				value: contentTypes.files,
				color: CONTENT_TYPE_COLORS.files,
			},
			{
				label: "Links",
				value: contentTypes.links,
				color: CONTENT_TYPE_COLORS.links,
			},
			{
				label: "Code",
				value: contentTypes.code,
				color: CONTENT_TYPE_COLORS.code,
			},
		].filter((item) => item.value > 0);
	}, [resolvedContentAnalysisData, hasMessageData]);

	// Prepare message length data from real data
	const messageLengthData = useMemo(() => {
		if (!resolvedContentAnalysisData || !hasMessageData) return [];

		const { messageLengthDistribution } = resolvedContentAnalysisData;
		return [
			{
				label: "Short (<50 chars)",
				value: messageLengthDistribution.short,
				color: MESSAGE_LENGTH_COLORS.short,
			},
			{
				label: "Medium (50-200 chars)",
				value: messageLengthDistribution.medium,
				color: MESSAGE_LENGTH_COLORS.medium,
			},
			{
				label: "Long (>200 chars)",
				value: messageLengthDistribution.long,
				color: MESSAGE_LENGTH_COLORS.long,
			},
		].filter((item) => item.value > 0);
	}, [resolvedContentAnalysisData, hasMessageData]);

	// Prepare busiest hours data from real data
	const busiestHoursData = useMemo(() => {
		if (!resolvedContentAnalysisData) return [];

		return resolvedContentAnalysisData.busiestHours.slice(0, 9).map((item) => ({
			label: item.label,
			value: item.count,
		}));
	}, [resolvedContentAnalysisData]);

	// Prepare weekly activity data from real data
	const weeklyActivityData = useMemo(() => {
		if (!resolvedContentAnalysisData) return [];

		return resolvedContentAnalysisData.activityByDay.map((item) => ({
			label: item.label,
			value: item.count,
		}));
	}, [resolvedContentAnalysisData]);

	// Prepare response times data from real data
	const responseTimesData = useMemo(() => {
		if (!resolvedContentAnalysisData) return [];

		return resolvedContentAnalysisData.channelResponseTimes.map((item) => {
			let color = "bg-success";
			if (item.avgResponseTime > 10) {
				color = "bg-warning";
			}
			if (item.avgResponseTime > 20) {
				color = "bg-destructive";
			}

			return {
				label: item.channelName,
				value: item.avgResponseTime,
				color,
			};
		});
	}, [resolvedContentAnalysisData]);

	// Prepare data for message activity by day
	const messagesByDayData = useMemo(() => {
		if (!resolvedMessageData) return [];

		return resolvedMessageData.messagesByDate.map((item) => ({
			label: format(new Date(item.date), "MMM dd"),
			value: item.count,
		}));
	}, [resolvedMessageData]);

	// Relocated from the old standalone Messages tab in the reports page: the
	// only two message stats that weren't already duplicates of the Overview
	// dashboard's "Total Messages" KPI.
	const dailyAverageMessages = useMemo(() => {
		if (
			!resolvedMessageData ||
			resolvedMessageData.messagesByDate.length === 0
		) {
			return 0;
		}
		return Math.round(
			resolvedMessageData.totalMessages /
				resolvedMessageData.messagesByDate.length
		);
	}, [resolvedMessageData]);

	const topSender = useMemo(() => {
		if (!resolvedMessageData || resolvedMessageData.topSenders.length === 0) {
			return null;
		}
		return resolvedMessageData.topSenders[0];
	}, [resolvedMessageData]);

	return (
		<div aria-busy={isInitialLoading} aria-live="polite" className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold">Content Analysis</h2>
				{isRefetching && (
					<span
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						role="status"
					>
						<Loader aria-hidden="true" className="size-3 animate-spin" />
						Updating…
					</span>
				)}
			</div>

			{/* Content tabs */}
			<Tabs className="space-y-4" defaultValue="messages">
				<TabsList>
					<TabsTrigger value="messages">
						<MessageSquare className="size-4 mr-2" />
						Messages
					</TabsTrigger>
					<TabsTrigger value="files">
						<FileText className="size-4 mr-2" />
						Files
					</TabsTrigger>
					<TabsTrigger value="activity">
						<Calendar className="size-4 mr-2" />
						Activity Patterns
					</TabsTrigger>
				</TabsList>

				{/* Messages Tab */}
				<TabsContent className="space-y-4" value="messages">
					{/* Plain tiles rather than StatCard: neither metric has a
					    previous-period comparison, and StatCard's caption only
					    renders alongside a delta chip. */}
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<Card className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<MessageSquare className="size-4" />
								Daily Average
							</div>
							{isInitialLoading ? (
								<Skeleton className="mt-2 h-8 w-16" />
							) : (
								<div className="mt-2 text-3xl font-semibold tracking-tight tabular-nums text-foreground">
									<AnimatedNumber value={dailyAverageMessages} />
								</div>
							)}
							<div className="mt-2 text-xs text-muted-foreground">
								messages per day
							</div>
						</Card>

						<Card className="p-5">
							<div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
								<Users className="size-4" />
								Top Sender
							</div>
							{isInitialLoading ? (
								<Skeleton className="mt-2 h-8 w-24" />
							) : (
								<div className="mt-2 truncate text-3xl font-semibold tracking-tight text-foreground">
									{topSender?.name ?? "No data"}
								</div>
							)}
							<div className="mt-2 text-xs text-muted-foreground">
								{topSender ? `${topSender.count} messages` : ""}
							</div>
						</Card>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Message Volume</CardTitle>
								<CardDescription>Messages over time</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{isInitialLoading ? (
										<Skeleton className="size-full" />
									) : messagesByDayData.length > 0 ? (
										<LineChart
											data={messagesByDayData}
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
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Content Types</CardTitle>
								<CardDescription>
									Distribution of content by type
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px]">
									{isInitialLoading ? (
										<Skeleton className="size-full" />
									) : (
										<PieChart
											data={contentTypeData}
											formatValue={(value) => `${value}%`}
										/>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Message Length Distribution</CardTitle>
							<CardDescription>Analysis of message lengths</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[240px] max-h-[240px] overflow-hidden">
								{isInitialLoading ? (
									<Skeleton className="size-full" />
								) : messageLengthData.length > 0 ? (
									<BarChart
										data={messageLengthData}
										formatValue={(value) => `${value}%`}
										height={200}
									/>
								) : (
									<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No message length data available
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Top Message Senders</CardTitle>
							<CardDescription>Users with most messages</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[300px] max-h-[300px] overflow-auto">
								{isInitialLoading ? (
									<Skeleton className="size-full" />
								) : resolvedMessageData?.topSenders &&
									resolvedMessageData.topSenders.length > 0 ? (
									<HorizontalBarChart
										data={resolvedMessageData.topSenders.map((sender) => ({
											label: sender.name,
											value: sender.count,
											color: "bg-secondary",
										}))}
										formatValue={(value) => `${value} messages`}
									/>
								) : (
									<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No sender data available
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Files Tab */}
				<TabsContent className="space-y-4" value="files">
					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>File Distribution</CardTitle>
							<CardDescription>
								Images and file attachments in messages
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[320px] max-h-[320px]">
								{isInitialLoading ? (
									<Skeleton className="size-full" />
								) : (
									<PieChart
										data={
											resolvedContentAnalysisData
												? [
														{
															label: "Images",
															value:
																resolvedContentAnalysisData.contentTypes.images,
															color: CONTENT_TYPE_COLORS.images,
														},
														{
															label: "Other Files",
															value:
																resolvedContentAnalysisData.contentTypes.files,
															color: CONTENT_TYPE_COLORS.files,
														},
													].filter((item) => item.value > 0)
												: []
										}
										formatValue={(value) => `${value}%`}
									/>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Activity Patterns Tab */}
				<TabsContent className="space-y-4" value="activity">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Busiest Hours</CardTitle>
								<CardDescription>
									Message activity by hour of day
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{isInitialLoading ? (
										<Skeleton className="size-full" />
									) : busiestHoursData.length > 0 ? (
										<BarChart
											data={busiestHoursData}
											formatValue={(value) => `${value} messages`}
											height={300}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No activity data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Weekly Activity Pattern</CardTitle>
								<CardDescription>
									Message activity by day of week
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{isInitialLoading ? (
										<Skeleton className="size-full" />
									) : weeklyActivityData.length > 0 ? (
										<BarChart
											data={weeklyActivityData}
											formatValue={(value) => `${value} messages`}
											height={300}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No activity data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Response Times</CardTitle>
							<CardDescription>
								Average time to first response in channels
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[240px] max-h-[240px] overflow-auto">
								{isInitialLoading ? (
									<Skeleton className="size-full" />
								) : responseTimesData.length > 0 ? (
									<HorizontalBarChart
										data={responseTimesData}
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
