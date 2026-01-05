'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { Id } from '@/../convex/_generated/dataModel';
import { format, subDays } from 'date-fns';
import {
  Loader,
  MessageSquare,
  Clock,
  FileText,
  Image as ImageIcon,
  File,
  Link as LinkIcon,
  BarChart as BarChartIcon,
  Calendar,
  Search
} from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { BarChart, PieChart, LineChart, HorizontalBarChart } from '@/features/reports/components/charts';
import { formatDuration } from '@/features/reports/utils/format-duration';

interface ContentAnalysisDashboardProps {
  workspaceId: Id<'workspaces'>;
  timeRange?: '1d' | '7d' | '30d';
}

export const ContentAnalysisDashboard = ({ workspaceId, timeRange = '7d' }: ContentAnalysisDashboardProps) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState('messages');

  // Calculate date ranges
  const endDate = useMemo(() => Date.now(), []);
  const startDate = useMemo(() => {
    switch (timeRange) {
      case '1d': return subDays(endDate, 1).getTime();
      case '7d': return subDays(endDate, 7).getTime();
      case '30d': return subDays(endDate, 30).getTime();
      default: return subDays(endDate, 7).getTime();
    }
  }, [timeRange, endDate]);

  // Fetch message analytics
  const messageData = useQuery(
    api.analytics.getMessageAnalytics,
    workspaceId ? {
      workspaceId,
      startDate,
      endDate,
    } : 'skip'
  );

  // Fetch task analytics
  const taskData = useQuery(
    api.analytics.getTaskAnalytics,
    workspaceId ? {
      workspaceId,
      startDate,
      endDate,
    } : 'skip'
  );

  const isLoading = !messageData || !taskData;

  // Mock data for content types (in a real app, this would come from the backend)
  const contentTypeData = useMemo(() => [
    { label: 'Text', value: 65, color: '#a78bfa' },      // Light purple
    { label: 'Images', value: 15, color: '#8b5cf6' },    // Medium purple
    { label: 'Files', value: 10, color: '#7c3aed' },     // Purple
    { label: 'Links', value: 8, color: '#ec4899' },      // Pink
    { label: 'Code', value: 2, color: '#f472b6' },       // Light pink
  ], []);

  // Mock data for message length distribution
  const messageLengthData = useMemo(() => [
    { label: 'Short (<50 chars)', value: 45, color: '#a5b4fc' },     // Light indigo
    { label: 'Medium (50-200 chars)', value: 35, color: '#6366f1' }, // Soft indigo
    { label: 'Long (>200 chars)', value: 20, color: '#4f46e5' },     // Deep indigo
  ], []);

  // Mock data for file types
  const fileTypeData = useMemo(() => [
    { label: 'Images', value: 42, color: '#a78bfa' },      // Light purple
    { label: 'Documents', value: 28, color: '#8b5cf6' },   // Medium purple
    { label: 'Spreadsheets', value: 15, color: '#7c3aed' },// Purple
    { label: 'PDFs', value: 10, color: '#ec4899' },        // Pink
    { label: 'Other', value: 5, color: '#f472b6' },        // Light pink
  ], []);

  // Mock data for busiest hours
  const busiestHoursData = useMemo(() => [
    { label: '9 AM', value: 120 },
    { label: '10 AM', value: 180 },
    { label: '11 AM', value: 240 },
    { label: '12 PM', value: 150 },
    { label: '1 PM', value: 90 },
    { label: '2 PM', value: 160 },
    { label: '3 PM', value: 210 },
    { label: '4 PM', value: 190 },
    { label: '5 PM', value: 110 },
  ], []);

  // Prepare data for message activity by day
  const messagesByDayData = useMemo(() => {
    if (!messageData) return [];

    return messageData.messagesByDate.map(item => ({
      label: format(new Date(item.date), 'MMM dd'),
      value: item.count
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
      <Tabs defaultValue="messages" className="space-y-4" onValueChange={setActiveTab}>
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
                <CardDescription>
                  Messages over time
                </CardDescription>
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
                      <p className="text-muted-foreground">No message data available</p>
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
                    data={contentTypeData}
                    formatValue={(value) => `${value}%`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Message Length Distribution</CardTitle>
              <CardDescription>
                Analysis of message lengths
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <div className="h-[240px] max-h-[240px] overflow-hidden">
                <BarChart
                  data={messageLengthData}
                  height={200}
                  formatValue={(value) => `${value}%`}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Top Message Senders</CardTitle>
              <CardDescription>
                Users with most messages
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <div className="h-[300px] max-h-[300px] overflow-auto">
                {messageData && messageData.topSenders && messageData.topSenders.length > 0 ? (
                  <HorizontalBarChart
                    data={messageData.topSenders.map(sender => ({
                      label: sender.name,
                      value: sender.count,
                      color: 'hsl(var(--secondary))'
                    }))}
                    formatValue={(value) => `${value} messages`}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full bg-muted/20 rounded-md">
                    <p className="text-muted-foreground">No sender data available</p>
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
                <CardTitle>File Types</CardTitle>
                <CardDescription>
                  Distribution of files by type
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <div className="h-[320px] max-h-[320px]">
                  <PieChart
                    data={fileTypeData}
                    formatValue={(value) => `${value}%`}
                  />
                </div>
              </CardContent>
            </Card>

            <Card className="flex flex-col">
              <CardHeader>
                <CardTitle>File Uploads Over Time</CardTitle>
                <CardDescription>
                  Number of files uploaded by day
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 min-h-0">
                <div className="h-[320px] max-h-[320px] overflow-hidden">
                  <LineChart
                    data={messagesByDayData.map(item => ({
                      ...item,
                      value: Math.round(item.value * 0.2) // Mock data - in real app would be actual file uploads
                    }))}
                    height={300}
                    formatValue={(value) => `${value} files`}
                  />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="flex flex-col">
            <CardHeader>
              <CardTitle>Top File Uploaders</CardTitle>
              <CardDescription>
                Users who uploaded the most files
              </CardDescription>
            </CardHeader>
            <CardContent className="flex-1 min-h-0">
              <div className="h-[240px] max-h-[240px] overflow-auto">
                <HorizontalBarChart
                  data={messageData?.topSenders?.slice(0, 5).map(sender => ({
                    label: sender.name,
                    value: Math.round(sender.count * 0.15), // Mock data - in real app would be actual file counts
                    color: '#22c55e'
                  })) || []}
                  formatValue={(value) => `${value} files`}
                />
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
                  <BarChart
                    data={busiestHoursData}
                    height={300}
                    formatValue={(value) => `${value} messages`}
                  />
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
                  <BarChart
                    data={[
                      { label: 'Mon', value: 180 },
                      { label: 'Tue', value: 220 },
                      { label: 'Wed', value: 240 },
                      { label: 'Thu', value: 210 },
                      { label: 'Fri', value: 170 },
                      { label: 'Sat', value: 60 },
                      { label: 'Sun', value: 40 },
                    ]}
                    height={300}
                    formatValue={(value) => `${value} messages`}
                  />
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
                <HorizontalBarChart
                  data={[
                    { label: 'General', value: 5, color: '#22c55e' },
                    { label: 'Marketing', value: 12, color: '#22c55e' },
                    { label: 'Development', value: 8, color: '#22c55e' },
                    { label: 'Design', value: 15, color: '#eab308' },
                    { label: 'Sales', value: 3, color: '#22c55e' },
                  ]}
                  formatValue={(value) => `${value} min`}
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};