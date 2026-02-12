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
import { useMutation } from "convex/react";
import { CheckSquare, MoveRight, Trash, X } from "lucide-react";
import React from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
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
	const [selectionMode, setSelectionMode] = React.useState(false);
	const [selectedCardIds, setSelectedCardIds] = React.useState<
		Set<Id<"cards">>
	>(new Set());
	const [bulkPriority, setBulkPriority] = React.useState<
		"" | "lowest" | "low" | "medium" | "high" | "highest"
	>("");
	const [bulkListId, setBulkListId] = React.useState<Id<"lists"> | "">("");

	const updateCard = useMutation(api.board.updateCard);
	const moveCard = useMutation(api.board.moveCard);
	const deleteCard = useMutation(api.board.deleteCard);

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
		if (selectionMode) {
			setActiveItem(null);
			setActiveId(null);
			setOverId(null);
			return;
		}
		setActiveItem(null);
		setActiveId(null);
		setOverId(null);

		// Log the drag event for debugging

		handleDragEnd(event);
	};

	const toggleSelectionMode = () => {
		setSelectionMode((prev) => {
			const next = !prev;
			if (!next) {
				setSelectedCardIds(new Set());
			}
			return next;
		});
	};

	const toggleSelectCard = (cardId: Id<"cards">) => {
		setSelectedCardIds((prev) => {
			const next = new Set(prev);
			if (next.has(cardId)) {
				next.delete(cardId);
			} else {
				next.add(cardId);
			}
			return next;
		});
	};

	const clearSelection = () => {
		setSelectedCardIds(new Set());
	};

	const selectAllCards = () => {
		const allIds = new Set<Id<"cards">>();
		Object.values(cardsByList).forEach((cards) => {
			cards.forEach((card) => allIds.add(card._id));
		});
		setSelectedCardIds(allIds);
	};

	const handleBulkSetPriority = async () => {
		if (!bulkPriority || selectedCardIds.size === 0) return;
		const updates = Array.from(selectedCardIds).map((cardId) =>
			updateCard({ cardId, priority: bulkPriority })
		);
		await Promise.all(updates);
		clearSelection();
	};

	const handleBulkMove = async () => {
		if (!bulkListId || selectedCardIds.size === 0) return;

		const targetCards = cardsByList[bulkListId] || [];
		const baseOrder = targetCards.filter(
			(card) => !selectedCardIds.has(card._id)
		).length;

		let order = baseOrder;
		for (const cardId of selectedCardIds) {
			await moveCard({
				cardId,
				toListId: bulkListId as Id<"lists">,
				order,
			});
			order += 1;
		}
		clearSelection();
	};

	const handleBulkDelete = async () => {
		if (selectedCardIds.size === 0) return;
		const confirmed = window.confirm(
			`Delete ${selectedCardIds.size} selected card(s)? This cannot be undone.`
		);
		if (!confirmed) return;
		const deletions = Array.from(selectedCardIds).map((cardId) =>
			deleteCard({ cardId })
		);
		await Promise.all(deletions);
		clearSelection();
	};

	const selectedCount = selectedCardIds.size;

	return (
		<div className="flex flex-col h-full bg-white dark:bg-gray-900">
			<div className="sticky top-0 z-20 bg-white dark:bg-gray-900 border-b dark:border-gray-800">
				<div className="flex flex-wrap items-center gap-2 p-3">
					<Button
						onClick={toggleSelectionMode}
						size="sm"
						variant={selectionMode ? "secondary" : "outline"}
					>
						<CheckSquare className="h-4 w-4 mr-2" />
						{selectionMode ? "Exit Selection" : "Select Cards"}
					</Button>

					{selectionMode && (
						<>
							<span className="text-sm text-muted-foreground">
								{selectedCount} selected
							</span>
							<Button onClick={selectAllCards} size="sm" variant="ghost">
								Select All
							</Button>
							<Button onClick={clearSelection} size="sm" variant="ghost">
								<X className="h-4 w-4 mr-1" />
								Clear
							</Button>

							<div className="flex items-center gap-2 ml-auto">
								<Select
									onValueChange={(value) =>
										setBulkPriority(
											value as
												| ""
												| "lowest"
												| "low"
												| "medium"
												| "high"
												| "highest"
										)
									}
									value={bulkPriority}
								>
									<SelectTrigger className="h-8 w-[140px]">
										<SelectValue placeholder="Set priority" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value="lowest">Lowest</SelectItem>
										<SelectItem value="low">Low</SelectItem>
										<SelectItem value="medium">Medium</SelectItem>
										<SelectItem value="high">High</SelectItem>
										<SelectItem value="highest">Highest</SelectItem>
									</SelectContent>
								</Select>
								<Button
									disabled={!bulkPriority || selectedCount === 0}
									onClick={handleBulkSetPriority}
									size="sm"
									variant="outline"
								>
									Apply
								</Button>

								<Select
									onValueChange={(value) => setBulkListId(value as Id<"lists">)}
									value={bulkListId}
								>
									<SelectTrigger className="h-8 w-[160px]">
										<SelectValue placeholder="Move to list" />
									</SelectTrigger>
									<SelectContent>
										{lists.map((list) => (
											<SelectItem key={list._id} value={list._id}>
												{list.title}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
								<Button
									disabled={!bulkListId || selectedCount === 0}
									onClick={handleBulkMove}
									size="sm"
									variant="outline"
								>
									<MoveRight className="h-4 w-4 mr-1" />
									Move
								</Button>

								<Button
									disabled={selectedCount === 0}
									onClick={handleBulkDelete}
									size="sm"
									variant="destructive"
								>
									<Trash className="h-4 w-4 mr-1" />
									Delete
								</Button>
							</div>
						</>
					)}
				</div>
			</div>
			<div className="flex flex-wrap overflow-y-auto gap-4 p-4 flex-1">
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
					collisionDetection={collisionDetectionStrategy}
					onDragEnd={onDragEnd}
					onDragOver={handleDragOver}
					onDragStart={selectionMode ? undefined : handleDragStart}
					sensors={sensors}
				>
					<SortableContext
						items={lists.map((l) => l._id)}
						strategy={horizontalListSortingStrategy}
					>
						{lists.map((list) => (
							<BoardList
								assigneeData={memberDataMap}
								cards={cardsByList[list._id] || []}
								disableListDrag={selectionMode}
								key={list._id}
								list={list}
								listCount={lists.length}
								onAddCard={() => onAddCard(list._id)}
								onDeleteCard={onDeleteCard}
								onDeleteList={() => onDeleteList(list)}
								onEditCard={onEditCard}
								onEditList={() => onEditList(list)}
								onToggleSelect={toggleSelectCard}
								selectedCardIds={selectedCardIds}
								selectionMode={selectionMode}
							/>
						))}
					</SortableContext>

					{/* Drag overlay for visual feedback */}
					<DragOverlay>
						{activeItem?.type === "card" && (
							<BoardCard
								assigneeData={memberDataMap}
								card={activeItem.item}
								onDelete={() => {}}
								onEdit={() => {}}
								selectionMode={false}
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
		</div>
	);
};

export default BoardKanbanView;
