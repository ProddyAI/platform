"use client";

import { useQuery } from "convex/react";
import { subDays } from "date-fns";
import {
	AlertTriangle,
	Clock,
	Hash,
	Loader,
	MessageSquare,
	RefreshCw,
} from "lucide-react";
import type { ErrorInfo, ReactNode } from "react";
import { Component, useEffect, useMemo, useRef, useState } from "react";
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
	NEUTRAL_COLOR,
	PieChart,
	seriesColor,
} from "@/features/reports/components/charts";
import { formatDuration } from "@/features/reports/utils/format-duration";

// Time threshold constants (in milliseconds). channelSessions.duration (the backend
// source of totalTimeSpent) and formatDuration() both use milliseconds — these must
// stay in the same unit or the color band and the displayed duration will diverge.
const TWO_HOURS_IN_MS = 2 * 60 * 60 * 1000;
const THIRTY_MINUTES_IN_MS = 30 * 60 * 1000;

const MAX_PIE_SEGMENTS = 5;

// How often to refresh "now" so a dashboard left open in a background tab doesn't
// keep querying an increasingly stale window.
const NOW_REFRESH_INTERVAL_MS = 60 * 1000;

interface ChannelActivityDashboardProps {
	workspaceId: Id<"workspaces">;
	timeRange?: "1d" | "7d" | "30d";
}

interface ChannelActivityErrorBoundaryState {
	hasError: boolean;
}

class ChannelActivityErrorBoundary extends Component<
	{ children: ReactNode },
	ChannelActivityErrorBoundaryState
> {
	state: ChannelActivityErrorBoundaryState = { hasError: false };

	static getDerivedStateFromError(): ChannelActivityErrorBoundaryState {
		return { hasError: true };
	}

	componentDidCatch(error: Error, info: ErrorInfo) {
		console.error(
			"[ChannelActivityDashboard] Failed to load channel activity:",
			error,
			info
		);
	}

	handleRetry = () => {
		this.setState({ hasError: false });
	};

	render() {
		if (this.state.hasError) {
			return (
				<div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg gap-2">
					<AlertTriangle className="h-8 w-8 text-destructive" />
					<h3 className="text-lg font-medium text-foreground">
						Couldn&apos;t load channel activity
					</h3>
					<p className="text-sm text-muted-foreground">
						Something went wrong while fetching this data.
					</p>
					<button
						className="mt-2 inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
						onClick={this.handleRetry}
						type="button"
					>
						<RefreshCw className="h-4 w-4" />
						Try again
					</button>
				</div>
			);
		}

		return this.props.children;
	}
}

const ChannelActivityDashboardSkeleton = () => (
	<div
		aria-busy="true"
		aria-label="Loading channel activity"
		className="space-y-6"
		role="status"
	>
		<div className="flex justify-between items-center">
			<h2 className="text-xl font-semibold text-foreground">
				Channel Activity
			</h2>
		</div>

		<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
			{Array.from({ length: 4 }).map((_, index) => (
				<Card className="border-border" key={`stat-skeleton-${index}`}>
					<CardHeader className="pb-2">
						<Skeleton className="h-4 w-24" />
					</CardHeader>
					<CardContent className="space-y-2">
						<Skeleton className="h-7 w-16" />
						<Skeleton className="h-3 w-32" />
					</CardContent>
				</Card>
			))}
		</div>

		<div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
			{Array.from({ length: 4 }).map((_, index) => (
				<Card className="flex flex-col" key={`chart-skeleton-${index}`}>
					<CardHeader className="space-y-2">
						<Skeleton className="h-5 w-40" />
						<Skeleton className="h-3 w-56" />
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] space-y-4 pt-2">
							{Array.from({ length: 6 }).map((_, barIndex) => (
								<Skeleton
									className="h-6 w-full"
									key={`chart-skeleton-${index}-bar-${barIndex}`}
								/>
							))}
						</div>
					</CardContent>
				</Card>
			))}
		</div>
	</div>
);

const ChannelActivityDashboardContent = ({
	workspaceId,
	timeRange = "7d",
}: ChannelActivityDashboardProps) => {
	// Refresh "now" periodically and when the tab regains focus so the selected
	// time range doesn't silently go stale in a long-lived background tab.
	const [now, setNow] = useState(() => Date.now());

	useEffect(() => {
		const interval = setInterval(
			() => setNow(Date.now()),
			NOW_REFRESH_INTERVAL_MS
		);
		const handleVisibilityChange = () => {
			if (document.visibilityState === "visible") {
				setNow(Date.now());
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);

		return () => {
			clearInterval(interval);
			document.removeEventListener("visibilitychange", handleVisibilityChange);
		};
	}, []);

	// Calculate date range based on selected time range
	const endDate = now;
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
		api.workspace.analytics.getChannelActivitySummary,
		workspaceId
			? {
					workspaceId,
					startDate,
					endDate,
				}
			: "skip"
	);

	// Keep the previous result on screen while a new range loads, instead of
	// dropping back to a blocking skeleton on every time-range change.
	const previousActivityRef = useRef<typeof channelActivityResult>(undefined);
	if (channelActivityResult !== undefined) {
		previousActivityRef.current = channelActivityResult;
	}
	const channelActivity = channelActivityResult ?? previousActivityRef.current;

	if (channelActivity === undefined) {
		return <ChannelActivityDashboardSkeleton />;
	}

	const isRefetching = channelActivityResult === undefined;

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

	// Prepare data for charts. A single token color per bar — color only carries
	// meaning where it encodes a real threshold, which is the time-spent chart below.
	const messageCountData = sortedByMessages.map((item) => ({
		label: item.channel.name,
		value: item.messageCount,
	}));

	const timeSpentData = sortedByTimeSpent
		.filter((item) => (item.totalTimeSpent || 0) > 0) // Only show channels with time spent
		.map((item) => {
			const timeValue = item.totalTimeSpent || 0;

			// Single-hue sequential scale (intensity via opacity) rather than
			// mixing unrelated semantic colors for "engagement" — matches the
			// same threshold treatment in the sibling user-activity-dashboard.
			const color =
				timeValue > TWO_HOURS_IN_MS
					? INTENSITY_COLOR_CLASSES.high
					: timeValue > THIRTY_MINUTES_IN_MS
						? INTENSITY_COLOR_CLASSES.medium
						: INTENSITY_COLOR_CLASSES.low;

			return {
				label: item.channel.name,
				value: timeValue,
				color,
			};
		});

	const visitorsData = sortedByVisitors.map((item) => ({
		label: item.channel.name,
		value: item.uniqueVisitors,
	}));

	// Prepare data for pie chart. Top channels get the design system's chart-series
	// colors; anything past the top N rolls up into a single "Other" slice instead
	// of silently disappearing from the total.
	const topByMessages = sortedByMessages.slice(0, MAX_PIE_SEGMENTS);
	const otherMessageCount = sortedByMessages
		.slice(MAX_PIE_SEGMENTS)
		.reduce((sum, item) => sum + item.messageCount, 0);

	const pieData = [
		...topByMessages.map((item, index) => ({
			label: item.channel.name,
			value: item.messageCount,
			color: seriesColor(index),
		})),
		...(otherMessageCount > 0
			? [{ label: "Other", value: otherMessageCount, color: NEUTRAL_COLOR }]
			: []),
	];

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
				{isRefetching && (
					<span
						aria-label="Refreshing channel activity"
						className="flex items-center gap-1.5 text-xs text-muted-foreground"
						role="status"
					>
						<Loader className="h-3.5 w-3.5 animate-spin" />
						Refreshing...
					</span>
				)}
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
								formatValue={(value) => `${value} messages`}
								height={30}
							/>
						</div>
					</CardContent>
				</Card>

				<Card className="flex flex-col">
					<CardHeader>
						<CardTitle>Message Distribution</CardTitle>
						<CardDescription>
							Percentage of messages by channel (top 5, rest grouped as Other)
						</CardDescription>
					</CardHeader>
					<CardContent className="flex-1 min-h-0">
						<div className="h-[400px] max-h-[400px] flex items-center justify-center overflow-auto">
							<PieChart
								data={pieData}
								formatValue={(value) => `${value} messages`}
								maxSize={450}
								size={350}
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
								formatValue={(value) => `${value} users`}
								height={30}
							/>
						</div>
					</CardContent>
				</Card>
			</div>
		</div>
	);
};

export const ChannelActivityDashboard = (
	props: ChannelActivityDashboardProps
) => (
	<ChannelActivityErrorBoundary>
		<ChannelActivityDashboardContent {...props} />
	</ChannelActivityErrorBoundary>
);
