import { useSearchParams } from 'next/navigation';
import { differenceInMinutes, format, isToday, isYesterday } from 'date-fns';
import { Loader, Sparkles } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { toast } from 'sonner';

import { useCurrentMember } from '@/features/members/api/use-current-member';
import type { GetMessagesReturnType } from '@/features/messages/api/use-get-messages';
import { useWorkspaceId } from '@/hooks/use-workspace-id';
import { ContextMenuProvider } from '@/features/chats/contexts/context-menu-context';

import { Id } from '../../convex/_generated/dataModel';
import { ChannelHero } from './channel-hero';
import { ConversationHero } from './conversation-hero';
import { Message } from './message';
import { DailyRecapModal } from '@/features/smart/components/daily-recap-modal';
import { Button } from './ui/button';
import { Hint } from './hint';
import './message-list-highlight.css';

const TIME_THRESHOLD = 15;

interface MessageListProps {
  memberName?: string;
  memberImage?: string;
  channelName?: string;
  channelCreationTime?: number;
  variant?: 'channel' | 'thread' | 'conversation';
  data: GetMessagesReturnType | undefined;
  loadMore: () => void;
  isLoadingMore: boolean;
  canLoadMore: boolean;
}

const formatDateLabel = (dateStr: string) => {
  const date = new Date(dateStr);

  if (isToday(date)) return 'Today';
  if (isYesterday(date)) return 'Yesterday';

  return format(date, 'EEEE, MMMM d');
};

export const MessageList = ({
  memberName,
  memberImage,
  channelName,
  channelCreationTime,
  data,
  variant = 'channel',
  loadMore,
  isLoadingMore,
  canLoadMore,
}: MessageListProps) => {
  const [editingId, setEditingId] = useState<Id<'messages'> | null>(null);

  const searchParams = useSearchParams();
  const highlightId = searchParams.get('highlight');
  const highlightedRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (highlightId && highlightedRef.current) {
      highlightedRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [highlightId, data]);
  const [isRecapModalOpen, setIsRecapModalOpen] = useState(false);
  const [recapData, setRecapData] = useState<{ recap: string; date: string; messageCount: number; isCached?: boolean } | null>(null);
  const [isGeneratingRecap, setIsGeneratingRecap] = useState(false);

  const workspaceId = useWorkspaceId();

  const { data: currentMember } = useCurrentMember({ workspaceId });

  const groupedMessages = data?.reduce(
    (groups, message) => {
      const date = new Date(message._creationTime);
      const dateKey = format(date, 'yyyy-MM-dd');

      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }

      groups[dateKey].unshift(message);

      return groups;
    },
    {} as Record<string, typeof data>
  );

  const handleGenerateRecap = async (dateKey: string, messages: typeof data) => {
    if (!messages || messages.length === 0 || isGeneratingRecap) return;

    setIsGeneratingRecap(true);

    try {
      // Show loading toast
      const loadingToast = toast.loading('Generating daily recap...', {
        duration: 10000,
      });

      // Format messages for the API
      const formattedMessages = messages.map(message => ({
        id: message._id,
        body: message.body,
        authorName: message.user.name,
        creationTime: message._creationTime
      }));

      // Send request to the API
      const response = await fetch('/api/smart/dailyrecap', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: formattedMessages,
          date: dateKey,
          channelName
        }),
      });

      // Dismiss loading toast
      toast.dismiss(loadingToast);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to generate daily recap');
      }

      const data = await response.json();

      // Set recap data and open modal
      setRecapData({
        recap: data.recap,
        date: dateKey,
        messageCount: messages.length,
        isCached: !!data.cached
      });
      setIsRecapModalOpen(true);

      // Show a small toast notification
      toast.success(data.cached ? 'Recap retrieved from cache' : 'Daily recap generated successfully');
    } catch (error) {
      console.error('Error generating daily recap:', error);
      toast.error('Failed to generate daily recap. Please try again.');
    } finally {
      setIsGeneratingRecap(false);
    }
  };

  return (
    <ContextMenuProvider>
      <div className="messages-scrollbar flex flex-1 flex-col-reverse overflow-y-auto pb-4">
        {recapData && (
          <DailyRecapModal
            isOpen={isRecapModalOpen}
            onClose={() => setIsRecapModalOpen(false)}
            recap={recapData.recap}
            date={recapData.date}
            messageCount={recapData.messageCount}
            isCached={recapData.isCached}
          />
        )}

        {Object.entries(groupedMessages || {}).map(([dateKey, messages]) => (
        <div key={dateKey}>
          <div className="relative my-2 text-center">
            <hr className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />

            <div className="relative inline-flex items-center gap-2">
              <span className="inline-block rounded-full border border-gray-300 bg-white px-4 py-1 text-xs shadow-sm">
                {formatDateLabel(dateKey)}
              </span>

              <Hint label="Generate daily recap">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 rounded-full bg-white border border-gray-300 shadow-sm hover:bg-blue-50"
                  onClick={() => handleGenerateRecap(dateKey, messages)}
                  disabled={isGeneratingRecap}
                >
                  <Sparkles className="size-3 text-blue-500 mr-1" />
                  <span className="text-xs font-medium text-blue-500">Recap</span>
                </Button>
              </Hint>
            </div>
          </div>

          {messages.map((message, i) => {
            const prevMessage = messages[i - 1];
            const isCompact =
              prevMessage &&
              prevMessage.user._id === message.user._id &&
              differenceInMinutes(
                new Date(message._creationTime),
                new Date(prevMessage._creationTime)
              ) < TIME_THRESHOLD;

            const isHighlighted = highlightId && message._id === (highlightId as Id<'messages'>);
            
            const messageElement = (
              <Message
                id={message._id}
                memberId={message.memberId}
                authorImage={message.user.image}
                authorName={message.user.name}
                isAuthor={message.memberId === currentMember?._id}
                reactions={message.reactions}
                body={message.body}
                image={message.image}
                updatedAt={message.updatedAt}
                createdAt={message._creationTime}
                threadCount={message.threadCount}
                threadImage={message.threadImage}
                threadName={message.threadName}
                threadTimestamp={message.threadTimestamp}
                isEditing={editingId === message._id}
                setEditingId={setEditingId}
                isCompact={isCompact}
                hideThreadButton={variant === 'thread'}
                calendarEvent={message.calendarEvent}
              />
            );

            if (isHighlighted) {
              return (
                <div
                  key={message._id}
                  ref={highlightedRef}
                  className="animate-highlight-gradient"
                >
                  {messageElement}
                </div>
              );
            }

            return messageElement;
          })}

        </div>
      ))}

      <div
        className="h-1"
        ref={(el) => {
          if (el) {
            const observer = new IntersectionObserver(
              ([entry]) => {
                if (entry.isIntersecting && canLoadMore) loadMore();
              },
              { threshold: 1.0 }
            );

            observer.observe(el);

            return () => observer.disconnect();
          }
        }}
      />

      {isLoadingMore && (
        <div className="relative my-2 text-center">
          <hr className="absolute left-0 right-0 top-1/2 border-t border-gray-300" />

          <span className="relative inline-block rounded-full border border-gray-300 bg-white px-4 py-1 text-xs shadow-sm">
            <Loader className="size-4 animate-spin" />
          </span>
        </div>
      )}

      {variant === 'channel' && channelName && channelCreationTime && (
        <ChannelHero name={channelName} creationTime={channelCreationTime} />
      )}
      {variant === 'conversation' && <ConversationHero name={memberName} image={memberImage} />}
      </div>
    </ContextMenuProvider>
  );
};
