'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { Id } from '@/../convex/_generated/dataModel';
import { format, subDays } from 'date-fns';
import { Loader, Users, Clock, MessageSquare, ThumbsUp } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BarChart, PieChart, HorizontalBarChart } from '@/features/reports/components/charts';
import { formatDuration } from '@/features/reports/utils/format-duration';

interface UserActivityDashboardProps {
  workspaceId: Id<'workspaces'>;
  timeRange?: '1d' | '7d' | '30d';
}

export const UserActivityDashboard = ({ workspaceId, timeRange = '7d' }: UserActivityDashboardProps) => {

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

  // Fetch user activity data
  const userActivityResult = useQuery(
    api.analytics.getUserActivitySummary,
    workspaceId ? {
      workspaceId,
      startDate,
      endDate,
    } : 'skip'
  );

  // Fetch current active users count for the selected time period
  const activeUsersData = useQuery(
    api.analytics.getActiveUsersCount,
    workspaceId ? {
      workspaceId,
      startDate,
      endDate,
    } : 'skip'
  );

  const isLoading = userActivityResult === undefined || activeUsersData === undefined;
  const userActivity = userActivityResult || [];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (userActivity.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-64 bg-muted/20 rounded-lg">
        <Users className="h-12 w-12 text-muted-foreground mb-2" />
        <h3 className="text-lg font-medium">No user activity data</h3>
        <p className="text-sm text-muted-foreground">
          Start interacting with the platform to generate activity data.
        </p>
      </div>
    );
  }

  // Sort users by message count
  const sortedByMessages = [...userActivity].sort((a, b) => b.messageCount - a.messageCount);

  // Sort users by time spent
  const sortedByTimeSpent = [...userActivity].sort((a, b) => {
    const timeA = a.totalTimeSpent || 0;
    const timeB = b.totalTimeSpent || 0;
    return timeB - timeA;
  });

  // Prepare data for charts
  const messageCountData = sortedByMessages.slice(0, 10).map(item => ({
    label: item.member?.user?.name || 'Unknown',
    value: item.messageCount,
    color: 'bg-secondary',
  }));

  const timeSpentData = sortedByTimeSpent
    .filter(item => (item.totalTimeSpent || 0) > 0) // Only show users with time spent
    .slice(0, 10)
    .map(item => {
      const timeValue = item.totalTimeSpent || 0;
      // Color code based on time spent (in seconds)
      // Green: > 1 hour, Yellow: 15min - 1 hour, Blue: < 15min
      const color = timeValue > 3600 
        ? 'bg-green-500' 
        : timeValue > 900 
          ? 'bg-yellow-500' 
          : 'bg-secondary';
      
      return {
        label: item.member?.user?.name || 'Unknown',
        value: timeValue,
        color,
      };
    });

  // Calculate total stats
  const totalMessages = userActivity.reduce((sum, item) => sum + item.messageCount, 0);
  const totalReactions = userActivity.reduce((sum, item) => sum + item.reactionCount, 0);
  const totalTimeSpent = userActivity.reduce((sum, item) => sum + item.totalTimeSpent, 0);

  // Use current active users count from dedicated query (currently logged in users)
  const activeUsers = activeUsersData?.activeUserCount || 0;
  const totalMembers = activeUsersData?.totalMembers || userActivity.length;
  const activeUserPercentage = activeUsersData?.activeUserPercentage || 0;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-semibold">User Activity</h2>
      </div>

      {/* Stats overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active Users</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <Users className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{activeUsers}</div>
            </div>
            <CardDescription>
              {activeUserPercentage}% of {totalMembers} total users
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
              {totalMembers > 0 ? (totalMessages / totalMembers).toFixed(1) : '0'} per user
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Reactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center">
              <ThumbsUp className="h-5 w-5 text-secondary mr-2" />
              <div className="text-2xl font-bold">{totalReactions}</div>
            </div>
            <CardDescription>
              {totalMembers > 0 ? (totalReactions / totalMembers).toFixed(1) : '0'} per user
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
              {activeUsers > 0 ? formatDuration(totalTimeSpent / activeUsers, 'short') : '0s'} per active user
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card className="flex flex-col">
          <CardHeader>
            <CardTitle>Messages by User</CardTitle>
            <CardDescription>
              Top 10 users by message count in the selected period
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
            <CardTitle>Time Spent by User</CardTitle>
            <CardDescription>
              Top 10 users by time spent in the selected period
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
                    Time spent data will appear as users interact with the workspace
                  </p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};
