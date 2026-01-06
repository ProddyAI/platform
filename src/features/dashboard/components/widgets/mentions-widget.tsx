'use client';

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { AtSign, CheckCircle, Clock, Hash, Loader } from 'lucide-react';
import { Id } from '@/../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { useGetMentionedMessages } from '@/features/messages/api/use-get-mentioned-messages';
import { useGetUnreadMentionsCount } from '@/features/messages/api/use-get-unread-mentions-count';
import { useMarkMentionAsRead } from '@/features/messages/api/use-mark-mention-as-read';
import { useMarkAllMentionsAsRead } from '@/features/messages/api/use-mark-all-mentions-as-read';
import { formatDistanceToNow } from 'date-fns';
import { WidgetCard } from '../shared/widget-card';

interface MentionsWidgetProps {
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

interface Mention {
  id: Id<'mentions'>;
  messageId?: Id<'messages'>;
  cardId?: Id<'cards'>;
  text: string;
  timestamp: number;
  read: boolean;
  author: {
    id: Id<'members'>;
    name: string;
    image?: string;
  };
  source: {
    type: 'channel' | 'direct' | 'thread' | 'card';
    id: Id<'channels'> | Id<'conversations'> | Id<'messages'> | Id<'cards'> | string;
    name: string;
  };
}

export const MentionsWidget = ({ workspaceId, isEditMode, controls }: MentionsWidgetProps) => {
  const router = useRouter();
  const { data: rawMentions, isLoading } = useGetMentionedMessages(false); // false to get only unread
  const { counts, isLoading: countsLoading } = useGetUnreadMentionsCount();
  const markAsRead = useMarkMentionAsRead();
  const markAllAsRead = useMarkAllMentionsAsRead();

  // Filter out mentions with invalid data
  const mentions = rawMentions ? rawMentions.filter((mention): mention is typeof mention =>
    mention !== undefined &&
    mention !== null &&
    mention.id !== undefined
  ) : [];

  const handleViewMention = (mention: Mention) => {
    // Mark as read
    markAsRead(mention.id);

    // Navigate based on mention type
    if (mention.source.type === 'channel') {
      router.push(`/workspace/${workspaceId}/channel/${mention.source.id}/chats`);
    } else if (mention.source.type === 'direct') {
      router.push(`/workspace/${workspaceId}/conversation/${mention.source.id}`);
    } else if (mention.source.type === 'thread' && mention.messageId) {
      router.push(`/workspace/${workspaceId}/thread/${mention.messageId}`);
    } else if (mention.source.type === 'card' && mention.cardId) {
      router.push(`/workspace/${workspaceId}/card/${mention.cardId}`);
    }
  };

  const handleMarkAllAsRead = async () => {
    await markAllAsRead();
  };

  // Extract plain text from message body (which might be rich text)
  const getMessagePreview = (text: string) => {
    try {
      // If it's JSON (rich text), try to extract plain text
      const parsed = JSON.parse(text);
      if (parsed.ops) {
        return parsed.ops
          .map((op: { insert?: string | object }) => (typeof op.insert === 'string' ? op.insert : ''))
          .join('')
          .trim()
          .substring(0, 50);
      }
      return text.substring(0, 50);
    } catch (e) {
      // If not JSON, just return the string
      return text.substring(0, 50);
    }
  };

  if (isLoading || countsLoading) {
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
          <AtSign className="h-5 w-5 text-primary dark:text-purple-400" />
          <h3 className="font-medium">Mentions</h3>
          {!isEditMode && counts && counts.total > 0 && (
            <Badge variant="default" className="ml-2">
              {counts.total}
            </Badge>
          )}
        </div>
        {isEditMode ? (
          controls
        ) : (
          counts && counts.total > 0 && (
            <Button variant="default" size="sm" onClick={handleMarkAllAsRead}>
              <CheckCircle className="mr-2 h-4 w-4" />
              Mark all as read
            </Button>
          )
        )}
      </div>

      {mentions && mentions.length > 0 ? (
        <ScrollArea className="widget-scroll-area">
          <div className="space-y-2 p-4">
            {mentions.map((mention) => (
              <WidgetCard key={mention.id}>
                  <div className="flex items-start gap-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage
                        src={mention.author.image}
                        alt={mention.author.name || 'User avatar'}
                      />
                      <AvatarFallback>
                        {mention.author.name ? mention.author.name.charAt(0).toUpperCase() : '?'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{mention.author.name || 'Unknown User'}</p>
                          {mention.source.type === 'channel' && (
                            <Badge variant="outline" className="flex items-center gap-1 border-2">
                              <Hash className="h-3 w-3" />
                              {mention.source.name}
                            </Badge>
                          )}
                        </div>
                        <div className="flex items-center text-xs text-muted-foreground">
                          <Clock className="mr-1 h-3 w-3" />
                          {(() => {
                            try {
                              // Try to safely format the date
                              if (mention.timestamp && !isNaN(Number(mention.timestamp))) {
                                const date = new Date(Number(mention.timestamp));
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
                      <p className="text-sm text-muted-foreground">
                        {getMessagePreview(mention.text)}
                        {mention.text.length > 50 ? '...' : ''}
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="mt-2 h-8 px-3 w-auto justify-start text-primary dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-600 hover:dark:bg-purple-400/10 hover:dark:text-purple-300"
                        onClick={() => handleViewMention(mention)}
                      >
                        View mention
                      </Button>
                    </div>
                  </div>
              </WidgetCard>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
          <AtSign className="mb-2 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No mentions</h3>
          <p className="text-sm text-muted-foreground">
            You haven't been mentioned recently
          </p>
        </div>
      )}
    </div>
  );
};