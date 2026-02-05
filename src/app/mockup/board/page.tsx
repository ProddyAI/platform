"use client";

import React, { useState } from "react";
import { TestBoardHeader } from "@/app/mockup/components/test-board-header";
import { TestBoardKanbanView } from "@/app/mockup/components/test-board-kanban-view";
import { TestBoardModals } from "@/app/mockup/components/test-board-modals";
import {
	TestLiveCursors,
	useTestLiveCursors,
} from "@/app/mockup/components/test-live-cursors";
import {
	TEST_CARDS,
	TEST_LISTS,
	TEST_MEMBERS,
} from "@/app/mockup/data/shared-test-data";
import { useDocumentTitle } from "@/hooks/use-document-title";

// Use shared test data for consistency
const DEMO_LISTS = TEST_LISTS;

const DEMO_CARDS = TEST_CARDS;

const DEMO_MEMBERS = TEST_MEMBERS;

const TestBoardPage = () => {
	useDocumentTitle("Board");
	const { showCursors } = useTestLiveCursors(true);

	const [view, setView] = useState<"kanban" | "table" | "gantt">("kanban");
	const [lists, _setLists] = useState(DEMO_LISTS);
	const [cards, setCards] = useState(DEMO_CARDS);

	// Modal states
	const [selectedCard, setSelectedCard] = useState<any>(null);
	const [isCardModalOpen, setIsCardModalOpen] = useState(false);
	const [isAddCardModalOpen, setIsAddCardModalOpen] = useState(false);
	const [selectedListId, setSelectedListId] = useState<string | null>(null);

	// Group cards by list
	const cardsByList = React.useMemo(() => {
		const grouped: Record<string, any[]> = {};
		lists.forEach((list) => {
			grouped[list._id] = cards
				.filter((card) => card.listId === list._id)
				.sort((a, b) => a.position - b.position);
		});
		return grouped;
	}, [lists, cards]);

	const handleEditCard = (card: any) => {
		setSelectedCard(card);
		setIsCardModalOpen(true);
	};

	const handleAddCard = (listId: string) => {
		setSelectedListId(listId);
		setIsAddCardModalOpen(true);
	};

	const handleDeleteCard = (cardId: string) => {
		setCards((prev) => prev.filter((card) => card._id !== cardId));
	};

	const handleSaveCard = (updatedCard: any) => {
		setCards((prev) =>
			prev.map((card) => (card._id === updatedCard._id ? updatedCard : card))
		);
		setIsCardModalOpen(false);
		setSelectedCard(null);
	};

	const handleCreateCard = (newCard: any) => {
		const cardWithId = {
			...newCard,
			_id: `card-${Date.now()}`,
			listId: selectedListId,
			position: cardsByList[selectedListId!]?.length || 0,
			_creationTime: Date.now(),
		};
		setCards((prev) => [...prev, cardWithId]);
		setIsAddCardModalOpen(false);
		setSelectedListId(null);
	};

	const handleDragEnd = (event: any) => {
	};

	const moveCardToNextList = (cardId: string) => {
		setCards((prev) =>
			prev.map((card) => {
				if (card._id === cardId) {
					const currentListIndex = lists.findIndex(
						(list) => list._id === card.listId
					);
					const nextListIndex = (currentListIndex + 1) % lists.length;
					return { ...card, listId: lists[nextListIndex]._id };
				}
				return card;
			})
		);
	};

	return (
		<div className="flex h-full flex-col">
			<TestBoardHeader
				cardCount={cards.length}
				listCount={lists.length}
				onViewChange={setView}
				view={view}
			/>

			<div className="flex-1 overflow-hidden">
				{view === "kanban" && (
					<TestBoardKanbanView
						cardsByList={cardsByList}
						handleDragEnd={handleDragEnd}
						lists={lists}
						members={DEMO_MEMBERS}
						onAddCard={handleAddCard}
						onDeleteCard={handleDeleteCard}
						onEditCard={handleEditCard}
						onMoveCard={moveCardToNextList}
					/>
				)}

				{view === "table" && (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						Table view coming soon...
					</div>
				)}

				{view === "gantt" && (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						Gantt view coming soon...
					</div>
				)}
			</div>

			<TestBoardModals
				isAddCardModalOpen={isAddCardModalOpen}
				isCardModalOpen={isCardModalOpen}
				lists={lists}
				members={DEMO_MEMBERS}
				onAddCardModalClose={() => {
					setIsAddCardModalOpen(false);
					setSelectedListId(null);
				}}
				onCardModalClose={() => {
					setIsCardModalOpen(false);
					setSelectedCard(null);
				}}
				onCreateCard={handleCreateCard}
				onSaveCard={handleSaveCard}
				selectedCard={selectedCard}
				selectedListId={selectedListId}
			/>

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />
		</div>
	);
};

export default TestBoardPage;
