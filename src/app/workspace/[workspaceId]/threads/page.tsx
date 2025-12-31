'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { ArrowRight, Clock, Filter, Hash, Loader, MessageSquareText, Search, SortDesc, User } from 'lucide-react';
import Link from 'next/link';
import { useState, useMemo } from 'react';

import type { Id } from '@/../convex/_generated/dataModel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useGetThreadMessages } from '@/features/messages/api/use-get-thread-messages';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';
import { useDocumentTitle } from '@/hooks/use-document-title';
import { useWorkspaceId } from '@/hooks/use-workspace-id';
import { WorkspaceToolbar } from '../toolbar';

interface ThreadMessage {
  message: {
    _id: Id<'messages'>;
    _creationTime: number;
    body: string;
    memberId: Id<'members'>;
    image?: Id<'_storage'>;
    channelId?: Id<'channels'>;
    conversationId?: Id<'conversations'>;
    parentMessageId?: Id<'messages'>;
    workspaceId: Id<'workspaces'>;
    updatedAt?: number;
  };
  parentMessage: {
    _id: Id<'messages'>;
    _creationTime: number;
    body: string;
    memberId: Id<'members'>;
  };
  parentUser: {
    name: string;
    image?: string;
  };
  currentUser: {
    name: string;
    image?: string;
  };
  context: {
    name: string;
    type: 'channel' | 'conversation' | 'unknown';
    id: Id<'channels'> | Id<'conversations'>;
    memberId?: Id<'members'>;
  };
}

export default function ThreadsPage() {
  // Set document title
  useDocumentTitle('Threads');

  const workspaceId = useWorkspaceId();
  const threads = useGetThreadMessages() as ThreadMessage[] | undefined;
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilter, setActiveFilter] = useState<'all' | 'channels' | 'direct'>('all');
  
  // Get all thread titles for this workspace
  const threadTitles = useQuery(api.threadTitles.getByWorkspaceId, {
    workspaceId,
  });

  // Create a map of messageId -> threadTitle for quick lookup
  const titleMap = useMemo(() => {
    const map = new Map<string, string>();
    if (threadTitles) {
      threadTitles.forEach((tt) => {
        map.set(tt.messageId.toString(), tt.title);
      });
    }
    return map;
  }, [threadTitles]);

  // Define helper functions first
  const parseMessageBody = (body: string) => {
    try {
      const parsed = JSON.parse(body);
      if (parsed.ops && parsed.ops[0] && parsed.ops[0].insert) {
        return parsed.ops[0].insert;
      }
    } catch (e) {
      // If parsing fails, return the original body
      return body;
    }
    return body;
  };

  const getThreadUrl = (thread: ThreadMessage) => {
    if (thread.context.type === 'channel') {
      return `/workspace/${workspaceId}/channel/${thread.context.id}/chats`;
    } else if (thread.context.type === 'conversation' && thread.context.memberId) {
      return `/workspace/${workspaceId}/member/${thread.context.memberId}`;
    }
    return '#';
  };

  // Filter threads based on search query and active filter
  const filteredThreads = threads?.filter(thread => {
    const matchesSearch = searchQuery === '' ||
      parseMessageBody(thread.message.body).toLowerCase().includes(searchQuery.toLowerCase()) ||
      parseMessageBody(thread.parentMessage.body).toLowerCase().includes(searchQuery.toLowerCase()) ||
      thread.context.name.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'channels' && thread.context.type === 'channel') ||
      (activeFilter === 'direct' && thread.context.type === 'conversation');

    return matchesSearch && matchesFilter;
  });

  // Group threads by date (today, yesterday, this week, earlier)
  const groupedThreads = filteredThreads?.reduce((groups, thread) => {
    const date = new Date(thread.message._creationTime);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === date.toDateString();
    const isThisWeek = date > new Date(now.setDate(now.getDate() - 6));

    const group = isToday ? 'today' : isYesterday ? 'yesterday' : isThisWeek ? 'thisWeek' : 'earlier';

    if (!groups[group]) {
      groups[group] = [];
    }

    groups[group].push(thread);
    return groups;
  }, {} as Record<string, ThreadMessage[]>) || {};

  // We'll use a consistent structure with conditional rendering for the content
  return (
    <>
      <WorkspaceToolbar>
        <Button
          variant="ghost"
          className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
          size="sm"
        >
          <MessageSquareText className="mr-2 size-5" />
          <span className="truncate">Threads</span>
        </Button>
      </WorkspaceToolbar>

      {!threads ? (
        // Loading state
        <div className="flex flex-1 w-full flex-col items-center justify-center gap-y-2 bg-white">
          <Loader className="size-12 animate-spin text-muted-foreground" />
          <p className="text-sm text-muted-foreground">Loading threads...</p>
        </div>
      ) : !threads.length ? (
        // Empty state
        <div className="flex flex-1 w-full flex-col items-center justify-center gap-y-2 bg-white">
          <MessageSquareText className="size-12 text-muted-foreground" />
          <h2 className="text-2xl font-semibold">Threads</h2>
          <p className="text-sm text-muted-foreground">No threads yet.</p>
        </div>
      ) : (
        // Threads loaded state
        <div className="flex flex-1 flex-col bg-white overflow-hidden">
          <div className="border-b p-4 flex-shrink-0">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold">Your Threads</h2>
              <div className="flex items-center gap-2">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <Filter className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Filter threads</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button variant="outline" size="icon" className="h-8 w-8">
                        <SortDesc className="h-4 w-4" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Sort threads</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="Search threads..."
                  className="pl-8"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </div>

              <Tabs defaultValue="all" className="w-[300px]">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger
                    value="all"
                    onClick={() => setActiveFilter('all')}
                  >
                    All
                  </TabsTrigger>
                  <TabsTrigger
                    value="channels"
                    onClick={() => setActiveFilter('channels')}
                  >
                    Channels
                  </TabsTrigger>
                  <TabsTrigger
                    value="direct"
                    onClick={() => setActiveFilter('direct')}
                  >
                    Direct
                  </TabsTrigger>
                </TabsList>
              </Tabs>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {filteredThreads?.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-y-2">
                <Search className="size-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No matching threads</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Today's threads */}
                {groupedThreads.today?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="rounded-full px-3 py-1 bg-secondary/5">
                        <Clock className="mr-1 h-3 w-3" />
                        Today
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.today.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {/* Yesterday's threads */}
                {groupedThreads.yesterday?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="rounded-full px-3 py-1 bg-muted">
                        <Clock className="mr-1 h-3 w-3" />
                        Yesterday
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.yesterday.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {/* This week's threads */}
                {groupedThreads.thisWeek?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="rounded-full px-3 py-1 bg-muted">
                        <Clock className="mr-1 h-3 w-3" />
                        This Week
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.thisWeek.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {/* Earlier threads */}
                {groupedThreads.earlier?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <Badge variant="outline" className="rounded-full px-3 py-1 bg-muted">
                        <Clock className="mr-1 h-3 w-3" />
                        Earlier
                      </Badge>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.earlier.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );

  function renderThreadCard(thread: ThreadMessage) {
    return (
      <div
        key={thread.message._id}
        className="flex flex-col rounded-lg border bg-white p-4 shadow-sm hover:shadow-md transition-all"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={`rounded-full px-2 py-0.5 ${thread.context.type === 'channel' ? 'bg-blue-50 text-blue-700' : 'bg-purple-50 text-purple-700'}`}
            >
              {thread.context.type === 'channel' ? (
                <span className="flex items-center">
                  <Hash className="mr-1 h-3 w-3" />
                  {thread.context.name}
                </span>
              ) : (
                <span className="flex items-center">
                  <User className="mr-1 h-3 w-3" />
                  {thread.context.name}
                </span>
              )}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(thread.message._creationTime), { addSuffix: true })}
            </span>
          </div>

          <Link
            href={getThreadUrl(thread)}
            className="text-xs font-medium text-secondary hover:underline flex items-center"
          >
            View <ArrowRight className="ml-1 h-3 w-3" />
          </Link>
        </div>

        {/* Thread Title - display saved title or parent message as context */}
        <div className="mb-3 p-3 rounded-lg bg-primary/5 border-l-2 border-primary">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Thread:</p>
          <p className="text-sm font-semibold text-foreground line-clamp-2 mt-1">
            {titleMap.get(thread.message._id.toString()) || parseMessageBody(thread.parentMessage.body)}
          </p>
        </div>

        {/* Parent Message */}
        <div className="flex items-start gap-3 mb-3 p-3 rounded-lg bg-muted/30">
          <Avatar className="h-8 w-8">
            <AvatarImage src={thread.parentUser.image} />
            <AvatarFallback>{thread.parentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{thread.parentUser.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(thread.parentMessage._creationTime), 'MMM d, h:mm a')}
              </span>
            </div>
            <p className="text-sm">{parseMessageBody(thread.parentMessage.body)}</p>
          </div>
        </div>

        {/* Thread Message */}
        <div className="flex items-start gap-3">
          <Avatar className="h-8 w-8">
            <AvatarImage src={thread.currentUser.image} />
            <AvatarFallback>{thread.currentUser.name.charAt(0)}</AvatarFallback>
          </Avatar>

          <div className="flex-1 space-y-1">
            <div className="flex items-center gap-2">
              <span className="font-medium text-sm">{thread.currentUser.name}</span>
              <span className="text-xs text-muted-foreground">
                {format(new Date(thread.message._creationTime), 'MMM d, h:mm a')}
              </span>
            </div>
            <p className="text-sm">{parseMessageBody(thread.message.body)}</p>
          </div>
        </div>
      </div>
    );
  }
}
