'use client';

import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Hint } from '@/components/hint';
import { MessageContent } from './message-content';
import { MessageContextMenu } from './message-context-menu';
import { useContextMenu } from '../contexts/context-menu-context';
import { formatFullTime } from '../utils/message-utils';
import type { MessageProps } from '../types/message';

interface FullMessageProps extends MessageProps {
  isPending: boolean;
  isSelected: boolean;
  onUpdate: ({ body }: { body: string }) => void;
  onReaction: (value: string) => void;
  onOpenMessage: (id: any) => void;
  onOpenProfile: (id: any) => void;
  onContextMenuAction: (action: string) => void;
}

export const FullMessage = ({
  id,
  isAuthor,
  body,
  createdAt,
  image,
  isEditing,
  authorName = 'Member',
  authorImage,
  memberId,
  reactions,
  setEditingId,
  updatedAt,
  hideThreadButton,
  threadCount,
  threadImage,
  threadName,
  threadTimestamp,
  calendarEvent,
  isPending,
  isSelected,
  onUpdate,
  onReaction,
  onOpenMessage,
  onOpenProfile,
  onContextMenuAction,
}: FullMessageProps) => {
  const { openContextMenu } = useContextMenu();
  const avatarFallback = authorName.charAt(0).toUpperCase();

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    openContextMenu(e.clientX, e.clientY, id);
  };

  return (
    <>
      <div
        className={cn(
          'group relative flex items-start gap-3 p-3 hover:bg-gray-200/40 dark:hover:bg-slate-700/50 transition-standard hover:shadow-sm rounded-[10px]',
          isEditing && 'bg-secondary/20 hover:bg-secondary/20',
          isPending && 'origin-bottom scale-y-0 transform bg-rose-500/50 transition-standard',
          isSelected && 'bg-secondary/10 hover:bg-secondary/10',
          isAuthor && 'flex-row-reverse'
        )}
        onContextMenu={handleContextMenu}
      >
        {/* Avatar */}
        <div className="flex-shrink-0">
          <button onClick={() => onOpenProfile(memberId)}>
            <Avatar>
              <AvatarImage alt={authorName} src={authorImage} />
              <AvatarFallback>{avatarFallback}</AvatarFallback>
            </Avatar>
          </button>
        </div>

        {/* Message Content */}
        <div className={cn("flex-1 min-w-0", isAuthor && "flex flex-col items-end")}>
          {/* Author and timestamp */}
          <div className={cn(
            "flex items-baseline gap-2 mb-1",
            isAuthor && "flex-row-reverse"
          )}>
            <button
              onClick={() => onOpenProfile(memberId)}
              className="font-medium text-sm hover:underline transition-all duration-200"
            >
              {authorName}
            </button>
            <Hint label={formatFullTime(new Date(createdAt))}>
              <button className="text-xs text-muted-foreground hover:underline transition-all duration-200">
                {format(new Date(createdAt), 'h:mm a')}
              </button>
            </Hint>
          </div>

          <MessageContent
            id={id}
            body={body}
            image={image}
            isEditing={isEditing}
            isAuthor={isAuthor}
            updatedAt={updatedAt}
            calendarEvent={calendarEvent}
            reactions={reactions}
            threadCount={threadCount}
            threadImage={threadImage}
            threadName={threadName}
            threadTimestamp={threadTimestamp}
            isPending={isPending}
            onUpdate={onUpdate}
            onCancel={() => setEditingId(null)}
            onReaction={onReaction}
            onOpenMessage={onOpenMessage}
            onContextMenu={handleContextMenu}
          />
        </div>
      </div>

      <MessageContextMenu
        messageId={id}
        isAuthor={isAuthor}
        isSelected={isSelected}
        hideThreadButton={hideThreadButton}
        onAction={onContextMenuAction}
      />
    </>
  );
};
