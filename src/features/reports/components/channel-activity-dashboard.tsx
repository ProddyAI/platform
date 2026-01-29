"use client";

import { useQuery } from "convex/react";
import { subDays } from "date-fns";
import { Clock, Hash, Loader, MessageSquare } from "lucide-react";
import { useMemo } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	HorizontalBarChart,
	PieChart,
} from "@/features/reports/components/charts";
import { formatDuration } from "@/features/reports/utils/format-duration";

// Time threshold constants (in seconds)
const TWO_HOURS_IN_SECONDS = 7200;
const THIRTY_MINUTES_IN_SECONDS = 1800;

interface ChannelActivityDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

export const ChannelActivityDashboard = ({
	workspaceId,
	timeRange = "7d",
}: ChannelActivityDashboardProps) => {
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

	// Fetch channel activity data
	const channelActivityResult = useQuery(
		api.analytics.getChannelActivitySummary,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	const isLoading = channelActivityResult === undefined;
	const channelActivity = channelActivityResult || [];

	if (isLoading) {
		return (
			<div className="flex items-center justify-center h-64">
				<Loader className="h-8 w-8 animate-spin text-secondary" />
			</div>
		);
	}

	if (channelActivity.length === 0) {
		return (
			<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
				<Hash className="h-12 w-12 text-muted-foreground mb-2" />
				<h3 className="text-lg font-medium">No channel activity data</h3>
				<p className="text-sm text-muted-foreground">
					Start interacting with channels to generate activity data.
				</p>
			</div>
		);
	}

	// Sort channels by message count
	const sortedByMessages = [...channelActivity].sort(
		(a, b) => b.messageCount - a.messageCount
	);

	// Sort channels by time spent
	const sortedByTimeSpent = [...channelActivity].sort((a, b) => {
		const timeA = a.totalTimeSpent || 0;
		const timeB = b.totalTimeSpent || 0;
		return timeB - timeA;
	});

	// Sort channels by unique visitors
	const sortedByVisitors = [...channelActivity].sort(
		(a, b) => b.uniqueVisitors - a.uniqueVisitors
	);

	// Prepare data for charts with gradient colors
	const messageCountData = sortedByMessages.map((item, index) => {
		// Create a nice gradient of colors for different channels
		const colors = [
			"bg-gradient-to-r from-purple-500 to-pink-500",
			"bg-gradient-to-r from-blue-500 to-cyan-500",
			"bg-gradient-to-r from-green-500 to-emerald-500",
			"bg-gradient-to-r from-orange-500 to-amber-500",
			"bg-gradient-to-r from-red-500 to-rose-500",
			"bg-gradient-to-r from-indigo-500 to-purple-500",
			"bg-gradient-to-r from-teal-500 to-green-500",
			"bg-gradient-to-r from-yellow-500 to-orange-500",
		];

		return {
			label: item.channel.name,
			value: item.messageCount,
			color: colors[index % colors.length],
		};
	});

	const timeSpentData = sortedByTimeSpent
		.filter((item) => (item.totalTimeSpent || 0) > 0) // Only show channels with time spent
		.map((item) => {
			const timeValue = item.totalTimeSpent || 0;

			const color =
				timeValue > TWO_HOURS_IN_SECONDS
					? "bg-green-500"
					: timeValue > THIRTY_MINUTES_IN_SECONDS
						? "bg-yellow-500"
						: "bg-secondary";

			return {
				label: item.channel.name,
				value: timeValue,
				color,
			};
		});

	const visitorsData = sortedByVisitors.map((item, index) => {
		// Use gradient colors for visitor data too
		const colors = [
			"bg-gradient-to-r from-blue-600 to-indigo-600",
			"bg-gradient-to-r from-purple-600 to-pink-600",
			"bg-gradient-to-r from-cyan-600 to-blue-600",
			"bg-gradient-to-r from-violet-600 to-purple-600",
			"bg-gradient-to-r from-fuchsia-600 to-pink-600",
			"bg-gradient-to-r from-indigo-600 to-blue-600",
			"bg-gradient-to-r from-blue-600 to-cyan-600",
			"bg-gradient-to-r from-purple-600 to-violet-600",
		];

		return {
			label: item.channel.name,
			value: item.uniqueVisitors,
			color: colors[index % colors.length],
		};
	});

	// Prepare data for pie chart
	const pieData = sortedByMessages.slice(0, 5).map((item, index) => {
		// Generate different colors for each segment - using actual hex colors
		const colors = [
			"#ff8566", // chart-1: coral/orange-red
			"#00e6b8", // chart-2: cyan/turquoise
			"#004d99", // chart-3: dark blue
			"#ffd633", // chart-4: yellow
			"#ffad33", // chart-5: orange
		];

		return {
			label: item.channel.name,
			value: item.messageCount,
			color: colors[index % colors.length],
		};
	});

	// Calculate total stats
	const totalMessages = channelActivity.reduce(
		(sum, item) => sum + item.messageCount,
		0
	);
	const totalTimeSpent = channelActivity.reduce(
		(sum, item) => sum + item.totalTimeSpent,
		0
	);
	const avgMessagesPerChannel = totalMessages / channelActivity.length;
	const avgTimeSpentPerChannel = totalTimeSpent / channelActivity.length;

	return (
		<div className="space-y-6">
			<div className="flex justify-between items-center">
				<h2 className="text-xl font-semibold text-foreground">
					Channel Activity
				</h2>
			</div>

			{/* Stats overview */}
			<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Total Channels
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Hash className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold text-foreground">
								{channelActivity.length}
							</div>
						</div>
						<CardDescription className="text-muted-foreground/80">
							Active in the selected period
						</CardDescription>
					</CardContent>
				</Card>

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
								{totalMessages}
							</div>
						</div>
						<CardDescription className="text-muted-foreground/80">
							{avgMessagesPerChannel.toFixed(1)} per channel
						</CardDescription>
					</CardContent>
				</Card>

				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Most Active Channel
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Hash className="h-5 w-5 text-secondary mr-2" />
							<div className="text-xl font-bold truncate text-foreground">
								{sortedByMessages[0]?.channel.name || "None"}
							</div>
						</div>
						<CardDescription className="text-muted-foreground/80">
							{sortedByMessages[0]?.messageCount || 0} messages
						</CardDescription>
					</CardContent>
				</Card>

				<Card className="border-border">
					<CardHeader className="pb-2">
						<CardTitle className="text-sm font-medium text-muted-foreground/90">
							Total Time Spent
						</CardTitle>
					</CardHeader>
					<CardContent>
						<div className="flex items-center">
							<Clock className="h-5 w-5 text-secondary mr-2" />
							<div className="text-2xl font-bold text-foreground">
								{formatDuration(totalTimeSpent, "short")}
							</div>
						</div>
						<CardDescription className="text-muted-foreground/80">
							{formatDuration(avgTimeSpentPerChannel, "short")} per channel
						</CardDescription>
					</CardContent>
				</Card>
			</div>

			{/* Charts */}
			<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Messages by Channel</CardTitle>
						<CardDescription>
							Number of messages in each channel
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] overflow-auto">
							<HorizontalBarChart
								data={messageCountData}
								height={30}
								formatValue={(value) => `${value} messages`}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Message Distribution</CardTitle>
						<CardDescription>
							Percentage of messages by channel (top 5)
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] flex items-center justify-center overflow-auto">
							<PieChart
								data={pieData}
								size={350}
								maxSize={450}
								formatValue={(value) => `${value} messages`}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Time Spent by Channel</CardTitle>
						<CardDescription>
							Total time users spent in each channel
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] overflow-auto">
							{timeSpentData.length > 0 ? (
								<HorizontalBarChart
									data={timeSpentData}
									height={30}
									formatValue={(value) => formatDuration(value, "short")}
								/>
							) : (
								<div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-md">
									<Clock className="h-12 w-12 text-muted-foreground mb-2" />
									<p className="text-muted-foreground text-sm">
										No time tracking data available
									</p>
									<p className="text-muted-foreground/70 text-xs mt-1">
										Time spent data will appear as users spend time in channels
									</p>
								</div>
							)}
						</div>
					</CardContent>
				</Card>

				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Unique Visitors by Channel</CardTitle>
						<CardDescription>
							Number of unique users who visited each channel
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] overflow-auto">
							<HorizontalBarChart
								data={visitorsData}
								height={30}
								formatValue={(value) => `${value} users`}
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};
