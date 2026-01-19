"use client";

import { useQuery } from "convex/react";
import { format, subDays } from "date-fns";
import { Calendar, FileText, Loader, MessageSquare } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
	BarChart,
	HorizontalBarChart,
	LineChart,
	PieChart,
} from "@/features/reports/components/charts";

interface ContentAnalysisDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const ContentAnalysisDashboard = ({
	workspaceId,
	timeRange = "7d",
}: ContentAnalysisDashboardProps) => {
	const [_searchQuery, _setSearchQuery] = useState("");
	const [_activeTab, setActiveTab] = useState("messages");

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

	// Fetch message analytics
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

	// Fetch content analysis data
	const contentAnalysisData = useQuery(
		api.analytics.getContentAnalysis,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	const isLoading = !messageData || !contentAnalysisData;

	// Check if we have actual message data
	const hasMessageData = useMemo(() => {
		return contentAnalysisData && contentAnalysisData.totalMessages > 0;
	}, [contentAnalysisData]);

	// Prepare content type data from real data
	const contentTypeData = useMemo(() => {
		if (!contentAnalysisData || !hasMessageData) return [];

		const { contentTypes } = contentAnalysisData;
		return [
			{ label: "Text", value: contentTypes.text, color: "#a78bfa" },
			{ label: "Images", value: contentTypes.images, color: "#8b5cf6" },
			{ label: "Files", value: contentTypes.files, color: "#7c3aed" },
			{ label: "Links", value: contentTypes.links, color: "#ec4899" },
			{ label: "Code", value: contentTypes.code, color: "#f472b6" },
		].filter((item) => item.value > 0);
	}, [contentAnalysisData, hasMessageData]);

	// Prepare message length data from real data
	const messageLengthData = useMemo(() => {
		if (!contentAnalysisData || !hasMessageData) return [];

		const { messageLengthDistribution } = contentAnalysisData;
		return [
			{
				label: "Short (<50 chars)",
				value: messageLengthDistribution.short,
				color: "#a5b4fc",
			},
			{
				label: "Medium (50-200 chars)",
				value: messageLengthDistribution.medium,
				color: "#6366f1",
			},
			{
				label: "Long (>200 chars)",
				value: messageLengthDistribution.long,
				color: "#4f46e5",
			},
		].filter((item) => item.value > 0);
	}, [contentAnalysisData, hasMessageData]);

	// Prepare busiest hours data from real data
	const busiestHoursData = useMemo(() => {
		if (!contentAnalysisData) return [];

		return contentAnalysisData.busiestHours.slice(0, 9).map((item) => ({
			label: item.label,
			value: item.count,
		}));
	}, [contentAnalysisData]);

	// Prepare weekly activity data from real data
	const weeklyActivityData = useMemo(() => {
		if (!contentAnalysisData) return [];

		return contentAnalysisData.activityByDay.map((item) => ({
			label: item.label,
			value: item.count,
		}));
	}, [contentAnalysisData]);

	// Prepare response times data from real data
	const responseTimesData = useMemo(() => {
		if (!contentAnalysisData) return [];

		return contentAnalysisData.channelResponseTimes.map((item) => {
			let color = "bg-green-500";
			if (item.avgResponseTime > 10) {
				color = "bg-yellow-500";
			}
			if (item.avgResponseTime > 20) {
				color = "bg-red-500";
			}

			return {
				label: item.channelName,
				value: item.avgResponseTime,
				color,
			};
		});
	}, [contentAnalysisData]);

	// Prepare data for message activity by day
	const messagesByDayData = useMemo(() => {
		if (!messageData) return [];

		return messageData.messagesByDate.map((item) => ({
			label: format(new Date(item.date), "MMM dd"),
			value: item.count,
		}));
	}, [messageData]);

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
				<h2 className="text-xl font-semibold">Content Analysis</h2>
			</div>

			{/* Content tabs */}
			<Tabs
				defaultValue="messages"
				className="space-y-4"
				onValueChange={setActiveTab}
			>
				<TabsList>
					<TabsTrigger value="messages">
						<MessageSquare className="h-4 w-4 mr-2" />
						Messages
					</TabsTrigger>
					<TabsTrigger value="files">
						<FileText className="h-4 w-4 mr-2" />
						Files
					</TabsTrigger>
					<TabsTrigger value="activity">
						<Calendar className="h-4 w-4 mr-2" />
						Activity Patterns
					</TabsTrigger>
				</TabsList>

				{/* Messages Tab */}
				<TabsContent value="messages" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Message Volume</CardTitle>
								<CardDescription>Messages over time</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{messagesByDayData.length > 0 ? (
										<LineChart
											data={messagesByDayData}
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
									<PieChart
										data={
											hasMessageData && contentTypeData.length > 0
												? contentTypeData
												: [
														{
															label: "No Data Available",
															value: 100,
															color: "#6b7280",
														},
													]
										}
										formatValue={(value) =>
											hasMessageData && contentTypeData.length > 0
												? `${value}%`
												: ""
										}
									/>
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
								{messageLengthData.length > 0 ? (
									<BarChart
										data={messageLengthData}
										height={200}
										formatValue={(value) => `${value}%`}
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
								{messageData?.topSenders &&
								messageData.topSenders.length > 0 ? (
									<HorizontalBarChart
										data={messageData.topSenders.map((sender) => ({
											label: sender.name,
											value: sender.count,
											color: "bg-pink-500",
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
				<TabsContent value="files" className="space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-6">
						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>File Distribution</CardTitle>
								<CardDescription>
									Images and file attachments in messages
								</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px]">
									<PieChart
										data={
											hasMessageData &&
											contentAnalysisData &&
											(contentAnalysisData.contentTypes.images > 0 ||
												contentAnalysisData.contentTypes.files > 0)
												? [
														{
															label: "Images",
															value: contentAnalysisData.contentTypes.images,
															color: "#a78bfa",
														},
														{
															label: "Other Files",
															value: contentAnalysisData.contentTypes.files,
															color: "#8b5cf6",
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
											hasMessageData &&
											contentAnalysisData &&
											(contentAnalysisData.contentTypes.images > 0 ||
												contentAnalysisData.contentTypes.files > 0)
												? `${value}%`
												: ""
										}
									/>
								</div>
							</CardContent>
						</Card>

						<Card className="flex flex-col">
							<CardHeader>
								<CardTitle>Image Uploads Over Time</CardTitle>
								<CardDescription>Messages with images by day</CardDescription>
							</CardHeader>
							<CardContent className="flex-1 min-h-0">
								<div className="h-[320px] max-h-[320px] overflow-hidden">
									{messagesByDayData.length > 0 ? (
										<LineChart
											data={messagesByDayData.map((item) => ({
												...item,
												value: Math.round(
													(item.value *
														(contentAnalysisData?.contentTypes.images || 15)) /
														100
												),
											}))}
											height={300}
											formatValue={(value) => `${value} images`}
										/>
									) : (
										<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
											<p className="text-muted-foreground">
												No image upload data available
											</p>
										</div>
									)}
								</div>
							</CardContent>
						</Card>
					</div>

					<Card className="flex flex-col">
						<CardHeader>
							<CardTitle>Top Image Uploaders</CardTitle>
							<CardDescription>
								Users who shared the most images
							</CardDescription>
						</CardHeader>
						<CardContent className="flex-1 min-h-0">
							<div className="h-[240px] max-h-[240px] overflow-auto">
								{messageData?.topSenders &&
								messageData.topSenders.length > 0 ? (
									<HorizontalBarChart
										data={messageData.topSenders.slice(0, 5).map((sender) => ({
											label: sender.name,
											value: Math.round(
												(sender.count *
													(contentAnalysisData?.contentTypes.images || 15)) /
													100
											),
											color: "bg-purple-500",
										}))}
										formatValue={(value) => `${value} images`}
									/>
								) : (
									<div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
										<p className="text-muted-foreground">
											No uploader data available
										</p>
									</div>
								)}
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				{/* Activity Patterns Tab */}
				<TabsContent value="activity" className="space-y-4">
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
									{busiestHoursData.length > 0 ? (
										<BarChart
											data={busiestHoursData}
											height={300}
											formatValue={(value) => `${value} messages`}
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
									{weeklyActivityData.length > 0 ? (
										<BarChart
											data={weeklyActivityData}
											height={300}
											formatValue={(value) => `${value} messages`}
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
								{responseTimesData.length > 0 ? (
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
