import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	type DragOverEvent,
	DragOverlay,
	type DragStartEvent,
	KeyboardSensor,
	PointerSensor,
	pointerWithin,
	rectIntersection,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	horizontalListSortingStrategy,
	SortableContext,
	sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import React from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import BoardCard from "./board-card";
import BoardList from "./board-list";

interface BoardKanbanViewProps {
	lists: any[];
	cardsByList: Record<string, any[]>;
	onEditList: (list: any) => void;
	onDeleteList: (list: any) => void;
	onAddCard: (listId: Id<"lists">) => void;
	onEditCard: (card: any) => void;
	onDeleteCard: (cardId: Id<"cards">) => void;
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
	members = [],
}) => {
	// Create a map of member data for easy lookup
	const memberDataMap = React.useMemo(() => {
		const map: Record<Id<"members">, { name: string; image?: string }> = {};
		members.forEach((member) => {
			if (member._id) {
				map[member._id] = {
					name: member.user?.name || "Unknown",
					image: member.user?.image,
				};
			}
		});
		return map;
	}, [members]);
	const [activeItem, setActiveItem] = React.useState<any>(null);
	const [_activeId, setActiveId] = React.useState<string | null>(null);
	const [_overId, setOverId] = React.useState<string | null>(null);

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
		if (active.data.current?.type === "card") {
			setActiveItem({
				type: "card",
				item: active.data.current.card,
			});
		} else if (active.data.current?.type === "list") {
			setActiveItem({
				type: "list",
				item: active.data.current.list,
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

		handleDragEnd(event);
	};

	return (
		<div className="flex flex-wrap overflow-y-auto gap-4 p-4 bg-white dark:bg-gray-900 h-full">
			<style jsx>{`
        /* Custom scrollbar styling for better UX
         * Shows styled scrollbars to indicate scrollable content
         * instead of completely hiding them which could confuse users
         */
        ::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        ::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .dark ::-webkit-scrollbar-track {
          background: #1f2937;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .dark ::-webkit-scrollbar-thumb {
          background: #4b5563;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
        .dark ::-webkit-scrollbar-thumb:hover {
          background: #6b7280;
        }
        /* Firefox scrollbar styling */
        * {
          scrollbar-width: thin;
          scrollbar-color: #cbd5e1 #f1f5f9;
        }
        .dark * {
          scrollbar-color: #4b5563 #1f2937;
        }
      `}</style>
			<DndContext
				sensors={sensors}
				collisionDetection={collisionDetectionStrategy}
				onDragStart={handleDragStart}
				onDragOver={handleDragOver}
				onDragEnd={onDragEnd}
			>
				<SortableContext
					items={lists.map((l) => l._id)}
					strategy={horizontalListSortingStrategy}
				>
					{lists.map((list) => (
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
					{activeItem?.type === "card" && (
						<BoardCard
							card={activeItem.item}
							onEdit={() => {}}
							onDelete={() => {}}
							assigneeData={memberDataMap}
						/>
					)}
					{activeItem?.type === "list" && (
						<div className="bg-gray-100 dark:bg-gray-800 rounded-lg shadow w-72 opacity-80 border-2 border-secondary">
							<div className="p-3 font-bold border-b dark:border-gray-700 dark:text-gray-100">
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
