import React from 'react';
import {
  DndContext,
  closestCenter,
  pointerWithin,
  rectIntersection,
  getFirstCollision,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  DragOverEvent,
  useSensor,
  useSensors,
  PointerSensor,
  KeyboardSensor
} from '@dnd-kit/core';
import {
  SortableContext,
  horizontalListSortingStrategy,
  sortableKeyboardCoordinates
} from '@dnd-kit/sortable';
import BoardList from './board-list';
import BoardCard from './board-card';
import type { Id } from '@/../convex/_generated/dataModel';

interface BoardKanbanViewProps {
  lists: any[];
  cardsByList: Record<string, any[]>;
  onEditList: (list: any) => void;
  onDeleteList: (list: any) => void;
  onAddCard: (listId: Id<'lists'>) => void;
  onEditCard: (card: any) => void;
  onDeleteCard: (cardId: Id<'cards'>) => void;
  handleDragEnd: (event: DragEndEvent) => void;
  members?: any[];
}

const BoardKanbanView: React.FC<BoardKanbanViewProps> = ({
  lists,
  cardsByList,
  onEditList,
  onDeleteList,
  onAddCard,
  onEditCard,
  onDeleteCard,
  handleDragEnd,
  members = []
}) => {
  // Create a map of member data for easy lookup
  const memberDataMap = React.useMemo(() => {
    const map: Record<Id<'members'>, { name: string; image?: string }> = {};
    members.forEach(member => {
      if (member._id) {
        map[member._id] = {
          name: member.user?.name || 'Unknown',
          image: member.user?.image
        };
      }
    });
    return map;
  }, [members]);
  const [activeItem, setActiveItem] = React.useState<any>(null);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [overId, setOverId] = React.useState<string | null>(null);

  // Configure sensors for better drag experience
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5, // 5px movement required before drag starts
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Custom collision detection strategy
  const collisionDetectionStrategy = React.useCallback((args: any) => {
    // First, check for intersections with droppable areas
    const intersections = rectIntersection(args);
    if (intersections.length > 0) {
      return intersections;
    }

    // If no direct intersections, use pointer within
    const pointerIntersections = pointerWithin(args);
    if (pointerIntersections.length > 0) {
      return pointerIntersections;
    }

    // Fallback to closest center
    return closestCenter(args);
  }, []);

  // Handle drag start to show the overlay
  const handleDragStart = (event: DragStartEvent) => {
    const { active } = event;
    setActiveId(active.id.toString());

    // Find if it's a card or list
    if (active.data.current?.type === 'card') {
      setActiveItem({
        type: 'card',
        item: active.data.current.card
      });
    } else if (active.data.current?.type === 'list') {
      setActiveItem({
        type: 'list',
        item: active.data.current.list
      });
    }
  };

  // Track what we're dragging over
  const handleDragOver = (event: DragOverEvent) => {
    const { over } = event;
    setOverId(over?.id.toString() || null);
  };

  // Reset active item after drag ends
  const onDragEnd = (event: DragEndEvent) => {
    setActiveItem(null);
    setActiveId(null);
    setOverId(null);

    // Log the drag event for debugging
    console.log('Drag end event:', {
      active: event.active,
      over: event.over,
      activeData: event.active.data.current,
      overData: event.over?.data.current
    });

    handleDragEnd(event);
  };

  return (
    <div className="flex flex-1 overflow-x-auto gap-4 p-4 bg-white" style={{ WebkitOverflowScrolling: 'touch' }}>
      <style jsx>{`
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      <DndContext
        sensors={sensors}
        collisionDetection={collisionDetectionStrategy}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={lists.map(l => l._id)} strategy={horizontalListSortingStrategy}>
          {lists.map(list => (
            <BoardList
              key={list._id}
              list={list}
              cards={cardsByList[list._id] || []}
              onEditList={() => onEditList(list)}
              onDeleteList={() => onDeleteList(list)}
              onAddCard={() => onAddCard(list._id)}
              onEditCard={onEditCard}
              onDeleteCard={onDeleteCard}
              assigneeData={memberDataMap}
              listCount={lists.length}
            />
          ))}
        </SortableContext>

        {/* Drag overlay for visual feedback */}
        <DragOverlay>
          {activeItem?.type === 'card' && (
            <BoardCard
              card={activeItem.item}
              onEdit={() => { }}
              onDelete={() => { }}
              assigneeData={memberDataMap}
            />
          )}
          {activeItem?.type === 'list' && (
            <div className="bg-gray-100 rounded-lg shadow w-72 opacity-80 border-2 border-secondary">
              <div className="p-3 font-bold border-b">
                {activeItem.item.title}
              </div>
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
};

export default BoardKanbanView;
