'use client';

import { format, formatDistanceToNow } from 'date-fns';
import { Clock, Filter, Hash, Loader, MessageSquareText, Search, SortDesc, User, PaintBucket, FileText, MessageCircle } from 'lucide-react';
import { useState, useMemo } from 'react';

import type { Id } from '@/../convex/_generated/dataModel';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { useGetThreadMessages } from '@/features/messages/api/use-get-thread-messages';
import { ThreadModal } from '@/features/messages/components/thread-modal';
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
    type: 'channel' | 'conversation';
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
  const [selectedThread, setSelectedThread] = useState<ThreadMessage | null>(null);
  
  // Get all thread titles for this workspace
  const threadTitles = useQuery(api.threadTitles.getByWorkspaceId, {
    workspaceId,
  });

  // Get thread reply counts
  const threadReplyCounts = useQuery(
    api.messages.getThreadReplyCounts,
    threads && threads.length > 0
      ? {
          parentMessageIds: threads
            .map((t) => t.message.parentMessageId)
            .filter(Boolean) as Id<'messages'>[],
        }
      : 'skip'
  );

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

  const parseMessageBody = (body: string): { type: 'text' | 'canvas' | 'note'; content: string; isSpecial: boolean } => {
    try {
      const parsed = JSON.parse(body);
      
      if (parsed.type && parsed.type.includes('canvas')) {
        return {
          type: 'canvas',
          content: parsed.canvasName || 'Untitled Canvas',
          isSpecial: true
        };
      }
      
      if (parsed.type && parsed.type.includes('note')) {
        return {
          type: 'note',
          content: parsed.noteTitle || 'Untitled Note',
          isSpecial: true
        };
      }
      
      if (parsed.ops && parsed.ops[0] && parsed.ops[0].insert) {
        return {
          type: 'text',
          content: parsed.ops[0].insert,
          isSpecial: false
        };
      }
      
      return {
        type: 'text',
        content: body,
        isSpecial: false
      };
    } catch {
      return {
        type: 'text',
        content: body,
        isSpecial: false
      };
    }
  };

  const handleOpenThread = (thread: ThreadMessage) => {
    setSelectedThread(thread);
  };

  // Filter threads based on search query and active filter
  const filteredThreads = threads?.filter(thread => {
    const messageBody = parseMessageBody(thread.message.body);
    const parentBody = parseMessageBody(thread.parentMessage.body);
    
    const matchesSearch = searchQuery === '' ||
      messageBody.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
      parentBody.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
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
              <h2 className="text-xl font-semibold">Threads</h2>
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

          <div className="flex-1 overflow-y-auto p-6">
            {filteredThreads?.length === 0 ? (
              <div className="flex h-full flex-col items-center justify-center gap-y-2">
                <Search className="size-12 text-muted-foreground" />
                <h3 className="text-lg font-medium">No matching threads</h3>
                <p className="text-sm text-muted-foreground">Try adjusting your search or filters</p>
              </div>
            ) : (
              <div className="space-y-6 max-w-4xl mx-auto">
                {groupedThreads.today?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Today
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.today.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {groupedThreads.yesterday?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Yesterday
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.yesterday.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {groupedThreads.thisWeek?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        This Week
                      </h3>
                    </div>
                    <div className="space-y-3">
                      {groupedThreads.thisWeek.map((thread) => renderThreadCard(thread))}
                    </div>
                  </div>
                )}

                {groupedThreads.earlier?.length > 0 && (
                  <div>
                    <div className="flex items-center gap-2 mb-4">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                        Earlier
                      </h3>
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

      {selectedThread && (
        <ThreadModal
          isOpen={!!selectedThread}
          onClose={() => setSelectedThread(null)}
          thread={selectedThread}
        />
      )}
    </>
  );

  function renderThreadCard(thread: ThreadMessage) {
    const parsedParentBody = parseMessageBody(thread.parentMessage.body);
    const threadReplyCount = threadReplyCounts?.find(
      (tc: any) => tc.parentMessageId === thread.message.parentMessageId
    )?.count || 0;

    return (
      <Card
        key={thread.message._id}
        className="group hover:shadow-md transition-all duration-200 cursor-pointer border-2"
        onClick={() => handleOpenThread(thread)}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarImage src={thread.parentUser.image} />
                <AvatarFallback>{thread.parentUser.name.charAt(0)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm truncate">{thread.parentUser.name}</span>
                  <Badge
                    variant="outline"
                    className={`rounded-full text-xs flex-shrink-0 ${
                      thread.context.type === 'channel'
                        ? 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300'
                        : 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300'
                    }`}
                  >
                    {thread.context.type === 'channel' ? (
                      <span className="flex items-center gap-1">
                        <Hash className="h-3 w-3" />
                        {thread.context.name}
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {thread.context.name}
                      </span>
                    )}
                  </Badge>
                </div>
                <span className="text-xs text-muted-foreground">
                  {formatDistanceToNow(new Date(thread.message._creationTime), { addSuffix: true })}
                </span>
              </div>
            </div>
          </div>

          <div className="mb-3">
            {parsedParentBody.isSpecial ? (
              <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-3 border border-primary/20">
                {parsedParentBody.type === 'canvas' ? (
                  <PaintBucket className="h-5 w-5 text-primary flex-shrink-0" />
                ) : (
                  <FileText className="h-5 w-5 text-primary flex-shrink-0" />
                )}
                <span className="font-semibold text-sm truncate">{parsedParentBody.content}</span>
              </div>
            ) : (
              <h3 className="font-semibold text-sm line-clamp-2 text-foreground">
                {titleMap.get(thread.message._id.toString()) || parsedParentBody.content}
              </h3>
            )}
          </div>

          <div className="flex items-start gap-2 p-2 rounded-md bg-muted/30">
            <Avatar className="h-6 w-6 flex-shrink-0">
              <AvatarImage src={thread.currentUser.image} />
              <AvatarFallback className="text-xs">{thread.currentUser.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <span className="font-medium text-xs text-muted-foreground">{thread.currentUser.name}</span>
              <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                {parseMessageBody(thread.message.body).content}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between mt-3 pt-3 border-t">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MessageCircle className="h-3.5 w-3.5" />
              <span>{threadReplyCount} {threadReplyCount === 1 ? 'reply' : 'replies'}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs font-medium text-primary hover:text-primary hover:bg-primary/10"
              onClick={(e) => {
                e.stopPropagation();
                handleOpenThread(thread);
              }}
            >
              Open
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }
}
