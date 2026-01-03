'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { Id } from '@/../convex/_generated/dataModel';
import { format, subDays } from 'date-fns';
import { Loader, Hash, Clock, MessageSquare, Users } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, PieChart, HorizontalBarChart } from '@/features/reports/components/charts';
import { formatDuration } from '@/features/reports/utils/format-duration';

// Time threshold constants (in seconds)
const TWO_HOURS_IN_SECONDS = 7200;
const THIRTY_MINUTES_IN_SECONDS = 1800;

interface ChannelActivityDashboardProps {
  workspaceId: Id<'workspaces'>;
  timeRange?: '1d' | '7d' | '30d';
}

export const ChannelActivityDashboard = ({ workspaceId, timeRange = '7d' }: ChannelActivityDashboardProps) => {

  // Calculate date range based on selected time range
  const endDate = useMemo(() => Date.now(), []); // Only calculate once on component mount
  const startDate = useMemo(() => {
    switch (timeRange) {
      case '1d': return subDays(endDate, 1).getTime();
      case '7d': return subDays(endDate, 7).getTime();
      case '30d': return subDays(endDate, 30).getTime();
      default: return subDays(endDate, 7).getTime();
    }
  }, [timeRange, endDate]);

  // Fetch channel activity data
  const channelActivityResult = useQuery(
    api.analytics.getChannelActivitySummary,
    workspaceId ? {
      workspaceId,
      startDate,
      endDate,
    } : 'skip'
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
  const sortedByMessages = [...channelActivity].sort((a, b) => b.messageCount - a.messageCount);

  // Sort channels by time spent
  const sortedByTimeSpent = [...channelActivity].sort((a, b) => {
    const timeA = a.totalTimeSpent || 0;
    const timeB = b.totalTimeSpent || 0;
    return timeB - timeA;
  });

  // Sort channels by unique visitors
  const sortedByVisitors = [...channelActivity].sort((a, b) => b.uniqueVisitors - a.uniqueVisitors);

  // Prepare data for charts
  const messageCountData = sortedByMessages.map(item => ({
    label: item.channel.name,
    value: item.messageCount,
    color: 'bg-secondary',
  }));

  const timeSpentData = sortedByTimeSpent
    .filter(item => (item.totalTimeSpent || 0) > 0) // Only show channels with time spent
    .map(item => {
      const timeValue = item.totalTimeSpent || 0;
      // Color code based on time spent (in seconds)
      // Green: > 2 hours, Yellow: 30min - 2 hours, Blue: < 30min
      const color = timeValue > TWO_HOURS_IN_SECONDS 
        ? 'bg-green-500' 
        : timeValue > THIRTY_MINUTES_IN_SECONDS 
          ? 'bg-yellow-500' 
          : 'bg-secondary';
      
      return {
        label: item.channel.name,
        value: timeValue,
        color,
      };
    });

  const visitorsData = sortedByVisitors.map(item => ({
    label: item.channel.name,
    value: item.uniqueVisitors,
    color: 'bg-primary',
  }));

  // Prepare data for pie chart
  const pieData = sortedByMessages.slice(0, 5).map((item, index) => {
    // Generate different colors for each segment
    const colors = ['bg-chart-1', 'bg-chart-2', 'bg-chart-3', 'bg-chart-4', 'bg-chart-5'];

    return {
      label: item.channel.name,
      value: item.messageCount,
      color: colors[index % colors.length],
    };
  });

  // Calculate total stats
  const totalMessages = channelActivity.reduce((sum, item) => sum + item.messageCount, 0);
  const totalTimeSpent = channelActivity.reduce((sum, item) => sum + item.totalTimeSpent, 0);
  const avgMessagesPerChannel = totalMessages / channelActivity.length;
  const avgTimeSpentPerChannel = totalTimeSpent / channelActivity.length;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">Channel Activity</h2>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Channels</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Hash className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{channelActivity.length}</div>
            </div>
            <CardDescription>
              Active in the selected period
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <MessageSquare className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{totalMessages}</div>
            </div>
            <CardDescription>
              {avgMessagesPerChannel.toFixed(1)} per channel
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Most Active Channel</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Hash className="h-5 w-5 text-secondary mr-2" />
              <div className="text-xl font-bold truncate">
                {sortedByMessages[0]?.channel.name || 'None'}
              </div>
            </div>
            <CardDescription>
              {sortedByMessages[0]?.messageCount || 0} messages
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Time Spent</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Clock className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{formatDuration(totalTimeSpent, 'short')}</div>
            </div>
            <CardDescription>
              {formatDuration(avgTimeSpentPerChannel, 'short')} per channel
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
                size={180}
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
                  formatValue={(value) => formatDuration(value, 'short')}
                />
              ) : (
                <div className="flex flex-col items-center justify-center h-full bg-muted/20 rounded-md">
                  <Clock className="h-12 w-12 text-muted-foreground mb-2" />
                  <p className="text-muted-foreground text-sm">No time tracking data available</p>
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
