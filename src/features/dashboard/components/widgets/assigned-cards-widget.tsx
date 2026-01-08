"use client";

import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, AlertCircle, Loader, KanbanSquare } from 'lucide-react';
import { Id } from '@/../convex/_generated/dataModel';
import { useRouter } from 'next/navigation';
import { formatDistanceToNow } from 'date-fns';
import { useGetAssignedCards } from '@/features/board/api/use-get-assigned-cards';
import { useGetChannels } from '@/features/channels/api/use-get-channels';
import { WidgetCard } from '../shared/widget-card';

interface AssignedCardsWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const AssignedCardsWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: AssignedCardsWidgetProps) => {
	const router = useRouter();

	// Fetch channels for the workspace
	const { data: channels } = useGetChannels({ workspaceId });

	// Fetch board items assigned to the current user
	const { data: assignedCards, isLoading: cardsLoading } = useGetAssignedCards({
		workspaceId,
	});

	// Sort board cards by due date and creation time
	const sortedCards = assignedCards
		? [...assignedCards]
				.sort((a, b) => {
					// Sort by due date if available
					if (a.dueDate && b.dueDate) {
						return a.dueDate - b.dueDate;
					}

					// If only one has a due date, prioritize it
					if (a.dueDate) return -1;
					if (b.dueDate) return 1;

					// Finally sort by creation time
					return b._creationTime - a._creationTime;
				})
				.slice(0, 10)
		: []; // Limit to 10 cards for the widget

	// Handle viewing a board card
	const handleViewCard = (card: any) => {
		const channelId = card.channelId;
		router.push(
			`/workspace/${workspaceId}/channel/${channelId}/board?cardId=${card._id}`
		);
	};

	if (cardsLoading) {
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
          <KanbanSquare className="h-5 w-5 text-primary widget-title-icon" />
          <h3 className="font-medium">Assigned Cards</h3>
          {!isEditMode && sortedCards.length > 0 && (
            <Badge variant="default" className="ml-2 widget-badge">
              {sortedCards.length}
            </Badge>
          )}
        </div>
        {isEditMode ? (
          controls
        ) : (
          channels && channels.length > 0 && (
            <Button
              variant="default"
              size="sm"
              className="widget-button"
              onClick={() => router.push(`/workspace/${workspaceId}/channel/${channels[0]._id}/board`)}
            >
              View all
            </Button>
          )
        )}
      </div>

      {sortedCards.length > 0 ? (
        <ScrollArea className="widget-scroll-area">
          <div className="space-y-2 p-4">
            {sortedCards.map((card) => (
              <WidgetCard key={card._id}>
                <div className="flex items-start gap-3">
                    <KanbanSquare className="h-5 w-5 text-primary widget-title-icon mt-1" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium">
                          {card.title}
                        </p>
                        <div className="flex items-center gap-2">
                          {card.dueDate && (
                            <div className={`flex items-center text-xs ${new Date(card.dueDate) < new Date()
                              ? 'text-red-500'
                              : 'text-muted-foreground'
                              }`}>
                              <Clock className="mr-1 h-3 w-3" />
                              {formatDistanceToNow(new Date(card.dueDate), { addSuffix: true })}
                              {new Date(card.dueDate) < new Date() && (
                                <AlertCircle className="ml-1 h-3 w-3" />
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-xs border-2">
                          {card.channelName || 'Unknown Channel'}
                        </Badge>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-3 text-xs text-primary dark:text-purple-400 hover:bg-purple-500/10 hover:text-purple-600 hover:dark:bg-purple-400/10 hover:dark:text-purple-300"
                          onClick={() => handleViewCard(card)}
                        >
                          View
                        </Button>
                      </div>
                    </div>
                  </div>
              </WidgetCard>
            ))}
          </div>
        </ScrollArea>
      ) : (
        <div className="flex h-[250px] flex-col items-center justify-center rounded-md border-2 bg-muted/10">
          <KanbanSquare className="mb-2 h-10 w-10 text-muted-foreground" />
          <h3 className="text-lg font-medium">No assigned cards</h3>
          <p className="text-sm text-muted-foreground">
            You don't have any board cards assigned
          </p>
          {channels && channels.length > 0 && (
            <div className="flex gap-2 mt-4">
              <Button
                variant="default"
                size="sm"
                onClick={() => router.push(`/workspace/${workspaceId}/channel/${channels[0]._id}/board`)}
              >
                View boards
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
