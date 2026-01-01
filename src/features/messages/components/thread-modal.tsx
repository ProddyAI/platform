'use client';

import { useState, useRef, useEffect } from 'react';
import { format } from 'date-fns';
import { Hash, User, Loader, MessageSquare, Paintbrush, FileText } from 'lucide-react';
import { useQuery } from 'convex/react';
import { toast } from 'sonner';

import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { api } from '@/../convex/_generated/api';
import type { Id } from '@/../convex/_generated/dataModel';
import { useCreateMessage } from '@/features/messages/api/use-create-message';
import { useWorkspaceId } from '@/hooks/use-workspace-id';
import Editor from '@/components/editor';

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

interface ThreadModalProps {
  isOpen: boolean;
  onClose: () => void;
  thread: ThreadMessage;
}

export const ThreadModal = ({ isOpen, onClose, thread }: ThreadModalProps) => {
  const workspaceId = useWorkspaceId();
  const [editorKey, setEditorKey] = useState(0);
  const editorRef = useRef<{ clear: () => void } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [paginationCursor, setPaginationCursor] = useState<string | null>(null);
  const [allReplies, setAllReplies] = useState<any[]>([]);
  
  const { mutate: createMessage, isPending } = useCreateMessage();

  const threadReplies = useQuery(
    api.messages.get,
    thread.message.parentMessageId
      ? {
          channelId: thread.message.channelId,
          conversationId: thread.message.conversationId,
          parentMessageId: thread.message.parentMessageId,
          paginationOpts: {
            numItems: 50,
            cursor: paginationCursor,
          },
        }
      : 'skip'
  );

  useEffect(() => {
    if (threadReplies?.page) {
      if (paginationCursor === null) {
        setAllReplies(threadReplies.page);
      } else {
        setAllReplies(prev => [...prev, ...threadReplies.page]);
      }
    }
  }, [threadReplies?.page, paginationCursor]);

  useEffect(() => {
    setPaginationCursor(null);
    setAllReplies([]);
  }, [thread.message._id, isOpen]);

  useEffect(() => {
    if (scrollRef.current && allReplies.length > 0 && paginationCursor === null) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [allReplies.length, paginationCursor]);

  const handleLoadMore = () => {
    if (threadReplies?.continueCursor) {
      setPaginationCursor(threadReplies.continueCursor);
    }
  };

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
    } catch (e) {
      return {
        type: 'text',
        content: body,
        isSpecial: false
      };
    }
  };

  const handleSubmit = async ({ body, image }: { body: string; image?: Id<'_storage'> }) => {
    try {
      await createMessage({
        workspaceId,
        channelId: thread.message.channelId,
        conversationId: thread.message.conversationId,
        parentMessageId: thread.message.parentMessageId,
        body,
        image,
      }, {
        onSuccess: () => {
          setEditorKey((prev) => prev + 1);
          editorRef.current?.clear();
        },
        throwError: true,
      });
    } catch (error) {
      console.error('Failed to send message:', error);
      toast.error('Failed to send message', {
        description: error instanceof Error ? error.message : 'Please try again',
      });
    }
  };

  const parsedParentBody = parseMessageBody(thread.parentMessage.body);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl h-[80vh] p-0 flex flex-col gap-0">
        {/* Header */}
        <div className="flex items-center gap-3 p-4 border-b flex-shrink-0">
          <MessageSquare className="h-5 w-5 text-primary" />
          <div>
            <h2 className="text-lg font-semibold">Thread</h2>
            <div className="flex items-center gap-2 mt-1">
              <Badge
                variant="outline"
                className={`rounded-full text-xs ${
                  thread.context.type === 'channel'
                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                    : 'bg-purple-50 text-purple-700 border-purple-200'
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
          </div>
        </div>

        <ScrollArea className="flex-1 p-4" ref={scrollRef}>
          <div className="space-y-4">
            <div className="rounded-lg border-2 border-primary/20 bg-primary/5 p-4">
              <div className="flex items-start gap-3">
                <Avatar className="h-10 w-10 flex-shrink-0">
                  <AvatarImage src={thread.parentUser.image} />
                  <AvatarFallback>{thread.parentUser.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{thread.parentUser.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {format(new Date(thread.parentMessage._creationTime), 'MMM d, h:mm a')}
                    </span>
                  </div>
                  {parsedParentBody.isSpecial ? (
                    <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-2 border border-primary/20">
                      {parsedParentBody.type === 'canvas' ? (
                        <span className="text-sm font-medium flex items-center gap-1.5">
                          <Paintbrush className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                          {parsedParentBody.content}
                        </span>
                      ) : (
                        <span className="text-sm font-medium flex items-center gap-1.5">
                          <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                          {parsedParentBody.content}
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm break-words">{parsedParentBody.content}</p>
                  )}
                </div>
              </div>
            </div>

            <Separator />

            {!threadReplies ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                {threadReplies.continueCursor && (
                  <div className="flex justify-center pb-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleLoadMore}
                      className="text-xs"
                    >
                      Load older replies
                    </Button>
                  </div>
                )}

                {allReplies.length > 0 ? (
                  <div className="space-y-3">
                    {allReplies.map((reply: any) => {
                  const parsedReplyBody = parseMessageBody(reply.body);
                  return (
                    <div key={reply._id} className="flex items-start gap-3 pl-4">
                      <Avatar className="h-8 w-8 flex-shrink-0">
                        <AvatarImage src={reply.user?.image} />
                        <AvatarFallback>{reply.user?.name?.charAt(0) || '?'}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="font-medium text-sm">{reply.user?.name || 'Unknown'}</span>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(reply._creationTime), 'MMM d, h:mm a')}
                          </span>
                        </div>
                         {parsedReplyBody.isSpecial ? (
                          <div className="flex items-center gap-2 rounded-md bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-700 dark:to-slate-800 p-2 border border-primary/20">
                            {parsedReplyBody.type === 'canvas' ? (
                              <span className="text-sm font-medium flex items-center gap-1.5">
                                <Paintbrush className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                                {parsedReplyBody.content}
                              </span>
                            ) : (
                              <span className="text-sm font-medium flex items-center gap-1.5">
                                <FileText className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                                {parsedReplyBody.content}
                              </span>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm break-words">{parsedReplyBody.content}</p>
                        )}
                      </div>
                    </div>
                  );
                    })}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mb-2" />
                    <p className="text-sm">No replies yet</p>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>

        <div className="border-t p-4 flex-shrink-0 bg-white dark:bg-card">
          <Editor
            key={editorKey}
            ref={editorRef}
            onSubmit={handleSubmit}
            disabled={isPending}
            placeholder="Reply to thread..."
            variant="create"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};