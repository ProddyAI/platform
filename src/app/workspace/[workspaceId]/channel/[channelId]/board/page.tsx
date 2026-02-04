"use client";

import type { DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import BoardGanttView from "@/features/board/components/board-gantt-view";
import BoardHeader from "@/features/board/components/board-header";
import BoardKanbanView from "@/features/board/components/board-kanban-view";
import {
	BoardAddCardModal,
	BoardAddListModal,
	BoardDeleteListModal,
	BoardEditCardModal,
	BoardEditListModal,
} from "@/features/board/components/board-models";
import BoardTableView from "@/features/board/components/board-table-view";
import { useChannelId } from "@/hooks/use-channel-id";
import { useDocumentTitle } from "@/hooks/use-document-title";

const BoardPage = () => {
	const channelId = useChannelId();
	const lists = useQuery(api.board.getLists, { channelId });
	const allCards =
		useQuery(api.board.getAllCardsForChannel, { channelId }) || [];
	const uniqueLabels = useQuery(api.board.getUniqueLabels, { channelId }) || [];
	const members = useQuery(api.board.getMembersForChannel, { channelId }) || [];
	const channel = useQuery(api.channels.getById, { id: channelId });

	// Set document title based on channel name
	useDocumentTitle(channel ? `Board - ${channel.name}` : "Board");
	const [view, setView] = useState<"kanban" | "table" | "gantt">("kanban");
	const [searchQuery, setSearchQuery] = useState("");
	const [listNameQuery, setListNameQuery] = useState("");

	// Modal state
	const [addListOpen, setAddListOpen] = useState(false);
	const [editListOpen, setEditListOpen] = useState(false);
	const [deleteListOpen, setDeleteListOpen] = useState(false);
	const [addCardOpen, setAddCardOpen] = useState<null | Id<"lists">>(null);
	const [editCardOpen, setEditCardOpen] = useState<null | { card: any }>();

	// Form state
	const [newListTitle, setNewListTitle] = useState("");
	const [editListTitle, setEditListTitle] = useState("");
	const [listToEdit, setListToEdit] = useState<any>(null);
	const [listToDelete, setListToDelete] = useState<any>(null);

	// Card form state
	const [cardTitle, setCardTitle] = useState("");
	const [cardDesc, setCardDesc] = useState("");
	const [cardLabels, setCardLabels] = useState("");
	const [cardPriority, setCardPriority] = useState<
		"lowest" | "low" | "medium" | "high" | "highest" | ""
	>("");
	const [cardDueDate, setCardDueDate] = useState<Date | undefined>(undefined);
	const [cardAssignees, setCardAssignees] = useState<Id<"members">[]>([]);

	// Mutations
	const createList = useMutation(api.board.createList);
	const updateList = useMutation(api.board.updateList);
	const deleteList = useMutation(api.board.deleteList);
	const reorderLists = useMutation(api.board.reorderLists);
	const createCard = useMutation(api.board.createCard);
	const updateCard = useMutation(api.board.updateCard);
	const deleteCard = useMutation(api.board.deleteCard);
	const moveCard = useMutation(api.board.moveCard);

	// Default lists on first load
	useEffect(() => {
		if (lists && lists.length === 0 && channelId) {
			const defaultLists = [
				{ title: "Planning", order: 0 },
				{ title: "Developing", order: 1 },
				{ title: "Reviewing", order: 2 },
				{ title: "Completed", order: 3 },
			];
			defaultLists.forEach(async ({ title, order }) => {
				await createList({ channelId, title, order });
			});
		}
	}, [lists, channelId, createList]);

	// Filter lists based on list name search (only for Kanban view)
	const filteredLists =
		lists?.filter((list) => {
			if (!listNameQuery || view !== "kanban") return true;
			const query = listNameQuery.toLowerCase();
			return list.title.toLowerCase().includes(query);
		}) || [];

	// Filter cards based on search query
	const filteredCards = allCards.filter((card) => {
		// General search filter
		if (searchQuery) {
			const query = searchQuery.toLowerCase();
			const list = lists?.find((l) => l._id === card.listId);
			const listTitle = list ? list.title : "";

			const matchesGeneralSearch =
				card.title.toLowerCase().includes(query) ||
				card.description?.toLowerCase().includes(query) ||
				listTitle.toLowerCase().includes(query) ||
				card.labels?.some((label: string) =>
					label.toLowerCase().includes(query)
				);

			if (!matchesGeneralSearch) return false;
		}

		// Filter cards to only show those from filtered lists (only for Kanban view)
		if (listNameQuery && view === "kanban") {
			const cardList = filteredLists.find((l) => l._id === card.listId);
			if (!cardList) return false;
		}

		return true;
	});

	// Group filtered cards by list
	const cardsByList: Record<string, any[]> = {};
	filteredCards.forEach((card) => {
		if (!cardsByList[card.listId]) cardsByList[card.listId] = [];
		cardsByList[card.listId].push(card);
	});

	// List handlers
	const handleAddList = async () => {
		if (!newListTitle.trim()) return;
		const order = lists ? lists.length : 0;
		await createList({ channelId, title: newListTitle, order });
		setNewListTitle("");
		setAddListOpen(false);
	};
	const handleEditList = async () => {
		if (!listToEdit || !editListTitle.trim()) return;
		await updateList({ listId: listToEdit._id, title: editListTitle });
		setEditListOpen(false);
		setListToEdit(null);
	};
	const handleDeleteList = async () => {
		if (!listToDelete) return;
		await deleteList({ listId: listToDelete._id });
		setDeleteListOpen(false);
		setListToDelete(null);
	};

	// Card handlers
	const handleAddCard = async (listId: Id<"lists">) => {
		if (!cardTitle.trim()) return;
		const cards = cardsByList[listId] || [];
		const order = cards.length;
		await createCard({
			listId,
			title: cardTitle,
			description: cardDesc,
			order,
			labels: cardLabels
				.split(",")
				.map((l) => l.trim())
				.filter(Boolean),
			priority: cardPriority || undefined,
			dueDate: cardDueDate ? cardDueDate.getTime() : undefined,
			assignees: cardAssignees.length > 0 ? cardAssignees : undefined,
		});
		setCardTitle("");
		setCardDesc("");
		setCardLabels("");
		setCardPriority("");
		setCardDueDate(undefined);
		setCardAssignees([]);
		setAddCardOpen(null);
	};
	const handleEditCard = async () => {
		if (!editCardOpen || !cardTitle.trim()) return;
		await updateCard({
			cardId: editCardOpen.card._id,
			title: cardTitle,
			description: cardDesc,
			labels: cardLabels
				.split(",")
				.map((l) => l.trim())
				.filter(Boolean),
			priority: cardPriority || undefined,
			dueDate: cardDueDate ? cardDueDate.getTime() : undefined,
			assignees: cardAssignees.length > 0 ? cardAssignees : undefined,
		});
		setEditCardOpen(null);
	};
	const handleDeleteCard = async (cardId: Id<"cards">) => {
		await deleteCard({ cardId });
		setEditCardOpen(null);
	};

	// Drag-and-drop for lists and cards
	const handleDragEnd = async (event: DragEndEvent) => {
		const { active, over } = event;
		if (!active || !over) {
			return;
		}

		// Log the drag event for debugging

		// Get data from the dragged item
		const activeType = active.data.current?.type;

		// List reordering
		if (activeType === "list" && lists) {
			const oldIndex = lists.findIndex((l) => l._id === active.id);
			const newIndex = lists.findIndex((l) => l._id === over.id);

			if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
				// Create a new array with the reordered lists
				const reorderedLists = arrayMove([...lists], oldIndex, newIndex);

				// Update the order property for each list
				const newOrder = reorderedLists.map((list, idx) => ({
					listId: list._id,
					order: idx,
				}));

				// Call the mutation to update the database
				try {
					await reorderLists({ listOrders: newOrder });
				} catch (error) {
					console.error("Error reordering lists:", error);
				}
			}
			return;
		}

		// Card drag-and-drop
		if (activeType === "card") {
			const cardId = active.id as Id<"cards">;
			let fromListId: Id<"lists"> | null = null;
			let toListId: Id<"lists"> | null = null;

			// Find the source list
			for (const list of lists || []) {
				const cards = cardsByList[list._id] || [];
				if (cards.some((c) => c._id === cardId)) {
					fromListId = list._id;
					break;
				}
			}

			// Determine the target list
			const overId = over.id.toString();

			// Check if dropped on a droppable area (list container)
			if (overId.startsWith("droppable-")) {
				toListId = overId.replace("droppable-", "") as Id<"lists">;
			}
			// Check if dropped on a list
			else if (over.data.current?.type === "list") {
				toListId = over.data.current.listId || (over.id as Id<"lists">);
			}
			// Check if dropped on a card
			else if (over.data.current?.type === "card") {
				// Find the list that contains this card
				const overCardId = over.id;
				for (const list of lists || []) {
					const cards = cardsByList[list._id] || [];
					if (cards.some((c) => c._id === overCardId)) {
						toListId = list._id;
						break;
					}
				}
			}

			if (fromListId && toListId) {
				// Calculate the new order
				const targetCards = cardsByList[toListId] || [];
				let newOrder = 0;

				// If dropped on a card, place it at that card's position
				if (over.data.current?.type === "card") {
					const overCardIndex = targetCards.findIndex((c) => c._id === over.id);
					if (overCardIndex !== -1) {
						newOrder = overCardIndex;
					}
				} else {
					// If dropped directly on a list, place at the end
					newOrder = targetCards.length;
				}

				try {
					await moveCard({
						cardId,
						toListId,
						order: newOrder,
					});
				} catch (error) {
					console.error("Error moving card:", error);
				}
			} else {
				console.warn("Could not determine source or target list");
			}
		}
	};

	if (!channelId) return <div className="p-4">No channel selected.</div>;
	if (!lists) return <div className="p-4">Loading board...</div>;

	return (
		<div className="h-full flex flex-col bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-950 overflow-hidden">
			<BoardHeader
				totalCards={allCards.length}
				listsCount={lists?.length || 0}
				view={view}
				setView={setView}
				onAddList={() => setAddListOpen(true)}
				onSearch={setSearchQuery}
				onSearchListName={setListNameQuery}
			/>

			<div className="flex-1 overflow-auto">
				{view === "kanban" && (
					<BoardKanbanView
						lists={filteredLists}
						cardsByList={cardsByList}
						onEditList={(list) => {
							setListToEdit(list);
							setEditListTitle(list.title);
							setEditListOpen(true);
						}}
						onDeleteList={(list) => {
							setListToDelete(list);
							setDeleteListOpen(true);
						}}
						onAddCard={(listId) => {
							setAddCardOpen(listId);
							setCardTitle("");
							setCardDesc("");
							setCardLabels("");
							setCardPriority("");
						}}
						onEditCard={(card) => {
							setEditCardOpen({ card });
							setCardTitle(card.title);
							setCardDesc(card.description || "");
							setCardLabels((card.labels || []).join(", "));
							setCardPriority(card.priority || "");
							setCardDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
							setCardAssignees(card.assignees || []);
						}}
						onDeleteCard={handleDeleteCard}
						handleDragEnd={handleDragEnd}
						members={members}
					/>
				)}

				{view === "table" && (
					<BoardTableView
						lists={lists}
						allCards={filteredCards}
						onEditCard={(card) => {
							setEditCardOpen({ card });
							setCardTitle(card.title);
							setCardDesc(card.description || "");
							setCardLabels((card.labels || []).join(", "));
							setCardPriority(card.priority || "");
							setCardDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
							setCardAssignees(card.assignees || []);
						}}
						onDeleteCard={handleDeleteCard}
						members={members}
					/>
				)}

				{view === "gantt" && (
					<BoardGanttView
						lists={lists}
						allCards={allCards}
						onEditCard={(card) => {
							setEditCardOpen({ card });
							setCardTitle(card.title);
							setCardDesc(card.description || "");
							setCardLabels((card.labels || []).join(", "));
							setCardPriority(card.priority || "");
							setCardDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
							setCardAssignees(card.assignees || []);
						}}
						onDeleteCard={handleDeleteCard}
						members={members}
					/>
				)}
			</div>

			{/* Modals */}
			<BoardAddListModal
				open={addListOpen}
				onOpenChange={setAddListOpen}
				title={newListTitle}
				setTitle={setNewListTitle}
				onAdd={handleAddList}
			/>
			<BoardEditListModal
				open={editListOpen}
				onOpenChange={setEditListOpen}
				title={editListTitle}
				setTitle={setEditListTitle}
				onSave={handleEditList}
			/>
			<BoardDeleteListModal
				open={deleteListOpen}
				onOpenChange={setDeleteListOpen}
				onDelete={handleDeleteList}
			/>
			<BoardAddCardModal
				open={!!addCardOpen}
				onOpenChange={(open: boolean) => {
					if (!open) {
						setAddCardOpen(null);
						setCardTitle("");
						setCardDesc("");
						setCardLabels("");
						setCardPriority("");
						setCardDueDate(undefined);
						setCardAssignees([]);
					}
				}}
				title={cardTitle}
				setTitle={setCardTitle}
				description={cardDesc}
				setDescription={setCardDesc}
				labels={cardLabels}
				setLabels={setCardLabels}
				priority={cardPriority}
				setPriority={setCardPriority}
				dueDate={cardDueDate}
				setDueDate={setCardDueDate}
				assignees={cardAssignees}
				setAssignees={setCardAssignees}
				members={members}
				labelSuggestions={uniqueLabels}
				onAdd={() => addCardOpen && handleAddCard(addCardOpen)}
			/>
			<BoardEditCardModal
				open={!!editCardOpen}
				onOpenChange={(open: boolean) => {
					if (!open) setEditCardOpen(null);
				}}
				title={cardTitle}
				setTitle={setCardTitle}
				description={cardDesc}
				setDescription={setCardDesc}
				labels={cardLabels}
				setLabels={setCardLabels}
				priority={cardPriority}
				setPriority={setCardPriority}
				dueDate={cardDueDate}
				setDueDate={setCardDueDate}
				assignees={cardAssignees}
				setAssignees={setCardAssignees}
				members={members}
				labelSuggestions={uniqueLabels}
				onSave={handleEditCard}
			/>
		</div>
	);
};

export default BoardPage;
