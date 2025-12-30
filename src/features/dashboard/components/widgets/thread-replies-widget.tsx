'use client';

import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { MessageSquareText, Hash, Clock, Loader } from 'lucide-react';
import { Id } from '@/../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { useGetThreadMessages } from '@/features/messages/api/use-get-thread-messages';
import { formatDistanceToNow } from 'date-fns';

interface ThreadRepliesWidgetProps {
  workspaceId: Id<'workspaces'>;
  member: {
    _id: Id<'members'>;
    userId: Id<'users'>;
    role: string;
    workspaceId: Id<'workspaces'>;
    user?: {
      name: string;
      image?: string;
    };
  };
  isEditMode?: boolean;
  controls?: React.ReactNode;
}

// Define the actual structure returned by the API
interface ThreadReplyMessage {
  message: {
    _id: Id<'messages'>;
    _creationTime: number;
    body: string;
    memberId: Id<'members'>;
    channelId?: Id<'channels'>;
    parentMessageId?: Id<'messages'>;
    workspaceId: Id<'workspaces'>;
  };
  parentMessage: {
    _id: Id<'messages'>;
    body: string;
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
  };
}

export const ThreadRepliesWidget = ({ workspaceId, isEditMode, controls }: ThreadRepliesWidgetProps) => {
  const router = useRouter();
  const rawThreadMessages = useGetThreadMessages();

  // Filter out threads with invalid data
  const threadMessages = rawThreadMessages ? rawThreadMessages.filter(thread =>
    thread !== undefined &&
    thread !== null &&
    thread.message?._id !== undefined &&
    thread.context?.type === 'channel' &&
    thread.message?.parentMessageId !== undefined
  ) : null;

  // Define the type for a thread message
  type ThreadMessageType = NonNullable<typeof threadMessages>[0];

  const handleViewThread = (thread: ThreadMessageType) => {
    if (thread.context.type === 'channel' && thread.message.parentMessageId) {
      router.push(`/workspace/${workspaceId}/channel/${thread.context.id as Id<'channels'>}/threads/${thread.message.parentMessageId}`);
    }
  };

  // Extract plain text from message body (which might be rich text)
  const getMessagePreview = (body: string) => {
    try {
      // If it's JSON (rich text), try to extract plain text
      const parsed = JSON.parse(body);
      if (parsed.ops) {
        return parsed.ops
          .map((op: { insert?: string | object }) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
          .trim()
          .substring(0, 50);
      }
      return body.substring(0, 50);
    } catch (e) {
      // If not JSON, just return the string
      return body.substring(0, 50);
    }
  };

  if (!threadMessages) {
    return (
      <div className="flex h-[300px] items-center justify-center">
        <Loader className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center justify-between pr-2">
        <div className="flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          <h3 className="font-medium">Thread Replies</h3>
          {!isEditMode && threadMessages.length > 0 && (
            <Badge variant="default" className="ml-2">
              {threadMessages.length}
            </Badge>
          )}
        </div>
        {isEditMode ? (
          controls
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/workspace/${workspaceId}/threads`)}
            className="border-2"
          >
            View All
          </Button>
        )}
      </div>

      {threadMessages && threadMessages.length > 0 ? (
        <ScrollArea className="h-[250px] rounded-md border-2">
          <div className="space-y-2 p-4">
            {threadMessages.map((thread) => (
              <Card key={thread.message._id.toString()} className="overflow-hidden border-2">
                <CardContent className="p-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={thread.currentUser.image}
                        alt={thread.currentUser.name || 'User avatar'}
                      />
                      <AvatarFallback>
                        {thread.currentUser.name ? thread.currentUser.name.charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{thread.currentUser.name || 'Unknown User'}</p>
                          {thread.context.type === 'channel' && (
                            <Badge variant="outline" className="flex items-center gap-1 border-2">
                              <Hash className="h-3 w-3" />
                              {thread.context.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {(() => {
                            try {
                              // Try to safely format the date
                              if (thread.message._creationTime && !isNaN(Number(thread.message._creationTime))) {
                                const date = new Date(Number(thread.message._creationTime));
                                if (date.toString() !== 'Invalid Date') {
                                  return formatDistanceToNow(date, { addSuffix: true });
                                }
                              }
                              return 'recently';
                            } catch (error) {
                              return 'recently';
                            }
                          })()}
                        </div>
                      </div>
                      <div className="rounded-md bg-muted/30 p-2 text-xs">
                        <p className="font-medium text-muted-foreground">
                          Replied to your thread:
                        </p>
                        <p className="mt-1">
                          {getMessagePreview(thread.message.body)}
                          {thread.message.body.length > 50 ? '...' : ''}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 w-full justify-start text-primary"
                        onClick={() => handleViewThread(thread)}
                      >
                        View thread
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
          <MessageSquareText className="mb-2 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No thread replies</h3>
          <p className="text-sm text-muted-foreground">
            You don't have any recent thread replies
          </p>
        </div>
      )}
    </div>
  );
};