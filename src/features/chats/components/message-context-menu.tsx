'use client';

import { Plus, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useContextMenu } from '../contexts/context-menu-context';
import { useMessageSelection } from '@/features/smart/contexts/message-selection-context';
import type { Id } from '../../../../convex/_generated/dataModel';

interface MessageContextMenuProps {
  messageId: Id<'messages'>;
  isAuthor: boolean;
  isSelected: boolean;
  hideThreadButton?: boolean;
  onAction: (action: string) => void;
}

export const MessageContextMenu = ({
  messageId,
  isAuthor,
  isSelected,
  hideThreadButton,
  onAction,
}: MessageContextMenuProps) => {
  const { contextMenu, closeContextMenu } = useContextMenu();
  const { selectedMessages } = useMessageSelection();

  if (!contextMenu.show || contextMenu.messageId !== messageId) {
    return null;
  }

  const handleAction = (action: string) => {
    onAction(action);
    closeContextMenu();
  };

  return (
    <div
      className="context-menu fixed bg-white dark:bg-slate-800 border border-gray-200 dark:border-slate-700 rounded-lg shadow-2xl z-[9999999] min-w-[180px] overflow-hidden"
      style={{
        left: `${contextMenu.x}px`,
        top: `${contextMenu.y}px`,
        pointerEvents: 'auto',
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Message Actions Section */}
      <div>
        <button
          className={cn(
            "w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors",
            isSelected 
              ? "bg-blue-50 dark:bg-slate-700 text-blue-600 dark:text-blue-300 font-medium"
              : "text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700"
          )}
          onClick={() => handleAction('select')}
        >
          {isSelected ? '✓ Selected' : 'Select Message'}
        </button>
        <button
          className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
          onClick={() => handleAction('copy')}
        >
          Copy Message
        </button>
      </div>

      <hr className="my-1 border-gray-200 dark:border-slate-700" />

      {/* Primary Action */}
      <button
        className="w-full px-4 py-2.5 text-left text-sm bg-primary text-white hover:bg-primary/90 dark:bg-purple-600 dark:hover:bg-purple-700 flex items-center gap-2 font-medium transition-colors"
        onClick={() => handleAction('addToTask')}
      >
        <Plus className="h-4 w-4" />
        Add as Task
      </button>

      <hr className="my-1 border-gray-200 dark:border-slate-700" />

      {/* Edit/Delete Section (Author only) */}
      {(isAuthor) && (
        <div>
          {isAuthor && (
            <button
              className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
              onClick={() => handleAction('edit')}
            >
              Edit
            </button>
          )}
          {isAuthor && (
            <button
              className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors"
              onClick={() => handleAction('delete')}
            >
              Delete
            </button>
          )}
        </div>
      )}

      {/* Thread Section */}
      {!hideThreadButton && (
        <>
          {isAuthor && <hr className="my-1 border-gray-200 dark:border-slate-700" />}
          <button
            className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-100 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
            onClick={() => handleAction('reply')}
          >
            Reply in Thread
          </button>
        </>
      )}
    </div>
  );
};
