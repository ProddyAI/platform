"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import BoardGanttView from "@/features/board/components/board-gantt-view";
import BoardHeader from "@/features/board/components/board-header";
import BoardIssueDrawer from "@/features/board/components/board-issue-drawer";
import BoardKanbanView from "@/features/board/components/board-kanban-view";
import {
	// Keep old card/list modals for gantt view
	BoardAddCardModal,
	BoardAddStatusModal,
	BoardDeleteListModal,
	BoardDeleteStatusModal,
	BoardEditCardModal,
	BoardEditStatusModal,
} from "@/features/board/components/board-models";
import { useBoardSearchStore } from "@/features/board/store/use-board-search";
import { useChannelId } from "@/hooks/use-channel-id";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const BoardPage = () => {
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();

	// Board search store integration
	const { setIsBoardPage, setBoardSearchQuery, boardSearchQuery } =
		useBoardSearchStore();

	// ── New: issues & statuses ──────────────────────────────────────────────
	const statuses = useQuery(api.board.getStatuses, { channelId });
	const allIssues = useQuery(api.board.getIssues, { channelId }) || [];
	const _uniqueIssueLabels =
		useQuery(api.board.getUniqueIssueLabels, { channelId }) || [];
	const [optimisticIssues, setOptimisticIssues] = useState<
		typeof allIssues | null
	>(null);

	// Clear optimistic state when server data actually updates
	useEffect(() => {
		if (allIssues.length > 0 && optimisticIssues) {
			// Create maps for comparison
			const serverMap = new Map(allIssues.map((i) => [i._id, i]));

			// Check if all optimistic issues exist in server data with same status/order
			const allMatch = optimisticIssues.every((optIssue) => {
				const serverIssue = serverMap.get(optIssue._id);
				if (!serverIssue) return false;
				return (
					serverIssue.statusId === optIssue.statusId &&
					serverIssue.order === optIssue.order
				);
			});

			// Only clear optimistic state if server data matches our optimistic update
			// This prevents the jarring "jump" when data syncs
			if (allMatch) {
				setOptimisticIssues(null);
			}
		}
	}, [allIssues, optimisticIssues]);

	// ── Existing: lists & cards (kept for table/gantt) ──────────────────────
	const lists = useQuery(api.board.getLists, { channelId });
	const allCards =
		useQuery(api.board.getAllCardsForChannel, { channelId }) || [];
	const uniqueLabels = useQuery(api.board.getUniqueLabels, { channelId }) || [];
	const members = useQuery(api.board.getMembersForChannel, { channelId }) || [];
	const channel = useQuery(api.channels.getById, { id: channelId });
	const currentMember = useQuery(api.members.current, { workspaceId });

	useDocumentTitle(channel ? `Board – ${channel.name}` : "Board");

	const [view, setView] = useState<"kanban" | "gantt">("kanban");

	// Set board page flag for global search
	useEffect(() => {
		setIsBoardPage(true);
		return () => {
			setIsBoardPage(false);
			setBoardSearchQuery("");
		};
	}, [setIsBoardPage, setBoardSearchQuery]);

	const displayedIssues = optimisticIssues ?? allIssues;

	// Filter issues based on global search query
	const filteredIssues = displayedIssues.filter((issue) => {
		if (!boardSearchQuery) return true;
		const query = boardSearchQuery.toLowerCase();
		return (
			issue.title.toLowerCase().includes(query) ||
			issue.description?.toLowerCase().includes(query) ||
			issue.labels?.some((label) => label.toLowerCase().includes(query))
		);
	});

	// ── Status modal state ──────────────────────────────────────────────────
	const [addStatusOpen, setAddStatusOpen] = useState(false);
	const [editStatusOpen, setEditStatusOpen] = useState(false);
	const [deleteStatusOpen, setDeleteStatusOpen] = useState(false);
	const [statusToEdit, setStatusToEdit] = useState<{
		_id: Id<"statuses">;
		name: string;
		color: string;
		order: number;
		channelId: Id<"channels">;
	} | null>(null);
	const [statusToDelete, setStatusToDelete] = useState<{
		_id: Id<"statuses">;
		name: string;
		color: string;
		order: number;
		channelId: Id<"channels">;
	} | null>(null);
	const [statusName, setStatusName] = useState("");
	const [statusColor, setStatusColor] = useState("#5e6ad2");

	// ── Issue drawer state ──────────────────────────────────────────────────
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [selectedIssue, setSelectedIssue] = useState<{
		_id: Id<"issues">;
		title: string;
		description?: string;
		statusId: Id<"statuses">;
		channelId: Id<"channels">;
		priority?: "urgent" | "high" | "medium" | "low" | "no_priority";
		assignees?: Id<"members">[];
		labels?: string[];
		dueDate?: number;
		order: number;
		createdAt: number;
		updatedAt: number;
	} | null>(null);

	// ── Optimistic statuses (for drag reorder) ──────────────────────────────
	const [optimisticStatuses, setOptimisticStatuses] = useState<
		| {
				_id: Id<"statuses">;
				name: string;
				color: string;
				order: number;
				channelId: Id<"channels">;
		  }[]
		| null
	>(null);
	const displayedStatuses = optimisticStatuses ?? statuses ?? [];
	const previousStatusOrderRef = useRef<typeof displayedStatuses | null>(null);

	// ── Old card modal state (for table/gantt views) ────────────────────────
	const [deleteListOpen, setDeleteListOpen] = useState(false);
	const [listToDelete, setListToDelete] = useState<{
		_id: Id<"lists">;
		title: string;
		order: number;
		channelId: Id<"channels">;
	} | null>(null);
	const [addCardOpen, setAddCardOpen] = useState<null | Id<"lists">>(null);
	const [editCardOpen, setEditCardOpen] = useState<{
		card: {
			_id: Id<"cards">;
			title: string;
			description?: string;
			listId: Id<"lists">;
			order: number;
			labels?: string[];
			priority?: "lowest" | "low" | "medium" | "high" | "highest";
			dueDate?: number;
			assignees?: Id<"members">[];
			isCompleted?: boolean;
			estimate?: number;
			timeSpent?: number;
			watchers?: Id<"members">[];
			blockedBy?: Id<"cards">[];
		};
	} | null>();
	const [cardTitle, setCardTitle] = useState("");
	const [cardDesc, setCardDesc] = useState("");
	const [cardLabels, setCardLabels] = useState("");
	const [cardPriority, setCardPriority] = useState<
		"lowest" | "low" | "medium" | "high" | "highest" | ""
	>("");
	const [cardDueDate, setCardDueDate] = useState<Date | undefined>(undefined);
	const [cardAssignees, setCardAssignees] = useState<Id<"members">[]>([]);

	// ── Mutations ───────────────────────────────────────────────────────────
	const migrate = useMutation(api.board.migrateListsToStatuses);
	const createStatus = useMutation(api.board.createStatus);
	const updateStatus = useMutation(api.board.updateStatus);
	const deleteStatus = useMutation(api.board.deleteStatus);
	const reorderStatuses = useMutation(api.board.reorderStatuses);
	const moveIssueStatus = useMutation(api.board.moveIssueStatus);
	const createIssue = useMutation(api.board.createIssue);

	// Existing card mutations
	const createCard = useMutation(api.board.createCard);
	const updateCard = useMutation(api.board.updateCard);
	const deleteCard = useMutation(api.board.deleteCard);
	const _moveCard = useMutation(api.board.moveCard);
	const deleteList = useMutation(api.board.deleteList);

	// ── Auto-migration on first load ────────────────────────────────────────
	useEffect(() => {
		if (statuses !== undefined && statuses.length === 0 && channelId) {
			migrate({ channelId }).catch(console.error);
		}
	}, [statuses, channelId, migrate]);

	// Sync optimistic statuses when real data arrives
	useEffect(() => {
		if (statuses) setOptimisticStatuses(null);
	}, [statuses]);

	// ── Status handlers ─────────────────────────────────────────────────────
	const handleAddStatus = async () => {
		if (!statusName.trim()) return;
		try {
			const order = statuses?.length ?? 0;
			await createStatus({
				channelId,
				name: statusName.trim(),
				color: statusColor,
				order,
			});
			setStatusName("");
			setStatusColor("#5e6ad2");
			setAddStatusOpen(false);
		} catch (error) {
			console.error("Failed to add status:", error);
			toast.error("Failed to add status");
		}
	};

	const handleEditStatus = async () => {
		if (!statusToEdit || !statusName.trim()) return;
		try {
			await updateStatus({
				statusId: statusToEdit._id,
				name: statusName.trim(),
				color: statusColor,
			});
			setEditStatusOpen(false);
			setStatusToEdit(null);
		} catch (error) {
			console.error("Failed to edit status:", error);
			toast.error("Failed to update status");
		}
	};

	const handleDeleteStatus = async () => {
		if (!statusToDelete) return;

		const deletedStatusId = statusToDelete._id;
		const previousOptimisticStatuses = optimisticStatuses;
		const previousOptimisticIssues = optimisticIssues;
		const baseStatuses = optimisticStatuses ?? statuses ?? [];
		const baseIssues = optimisticIssues ?? allIssues;

		setOptimisticStatuses(
			baseStatuses
				.filter((status) => status._id !== deletedStatusId)
				.map((status, index) => ({ ...status, order: index }))
		);
		setOptimisticIssues(
			baseIssues.filter((issue) => issue.statusId !== deletedStatusId)
		);

		try {
			await deleteStatus({ statusId: deletedStatusId });
			setDeleteStatusOpen(false);
			setStatusToDelete(null);
		} catch (error) {
			setOptimisticStatuses(previousOptimisticStatuses);
			setOptimisticIssues(previousOptimisticIssues);
			throw error;
		}
	};

	// ── Issue handlers ──────────────────────────────────────────────────────
	const handleCreateIssue = async (statusId: Id<"statuses">, title: string) => {
		const statusIssues = (optimisticIssues ?? allIssues).filter(
			(i) => i.statusId === statusId
		);
		await createIssue({
			channelId,
			statusId,
			title,
			order: statusIssues.length,
		});
	};

	const handleClickIssue = (issue: {
		_id: Id<"issues">;
		title: string;
		description?: string;
		statusId: Id<"statuses">;
		channelId: Id<"channels">;
		priority?: "urgent" | "high" | "medium" | "low" | "no_priority";
		assignees?: Id<"members">[];
		labels?: string[];
		dueDate?: number;
		order: number;
		createdAt: number;
		updatedAt: number;
	}) => {
		setSelectedIssue(issue);
		setDrawerOpen(true);
	};

	// ── Reorder statuses (optimistic) ───────────────────────────────────────
	const handleReorderStatuses = (
		newOrder: {
			_id: Id<"statuses">;
			name: string;
			color: string;
			order: number;
			channelId: Id<"channels">;
		}[]
	) => {
		previousStatusOrderRef.current = [...displayedStatuses];
		setOptimisticStatuses(newOrder.map((s, idx) => ({ ...s, order: idx })));
	};

	const handleMoveIssueStatus = async (
		issueId: Id<"issues">,
		toStatusId: Id<"statuses">,
		order: number
	) => {
		const currentIssues = optimisticIssues ?? allIssues;
		const movingIssue = currentIssues.find((issue) => issue._id === issueId);
		if (!movingIssue) return;

		const fromStatusId = movingIssue.statusId;
		let nextIssues: typeof currentIssues;

		if (fromStatusId === toStatusId) {
			const sameStatusIssues = currentIssues
				.filter((issue) => issue.statusId === fromStatusId)
				.sort((a, b) => a.order - b.order);

			const fromIndex = sameStatusIssues.findIndex(
				(issue) => issue._id === issueId
			);
			if (fromIndex === -1) return;

			const reorderedSameStatus = [...sameStatusIssues];
			const [removedIssue] = reorderedSameStatus.splice(fromIndex, 1);
			if (!removedIssue) return;

			const targetIndex = Math.max(
				0,
				Math.min(order, reorderedSameStatus.length)
			);
			reorderedSameStatus.splice(targetIndex, 0, {
				...removedIssue,
				statusId: toStatusId,
				order: targetIndex,
			});

			const normalizedSameStatus = reorderedSameStatus.map((issue, idx) => ({
				...issue,
				order: idx,
			}));

			const untouchedIssues = currentIssues.filter(
				(issue) => issue.statusId !== fromStatusId
			);

			nextIssues = [...untouchedIssues, ...normalizedSameStatus];
		} else {
			const sourceIssues = currentIssues
				.filter(
					(issue) => issue.statusId === fromStatusId && issue._id !== issueId
				)
				.sort((a, b) => a.order - b.order)
				.map((issue, idx) => ({ ...issue, order: idx }));

			const destinationIssues = currentIssues
				.filter(
					(issue) => issue.statusId === toStatusId && issue._id !== issueId
				)
				.sort((a, b) => a.order - b.order);

			const insertAt = Math.max(0, Math.min(order, destinationIssues.length));
			destinationIssues.splice(insertAt, 0, {
				...movingIssue,
				statusId: toStatusId,
				order: insertAt,
			});

			const normalizedDestinationIssues = destinationIssues.map(
				(issue, idx) => ({
					...issue,
					order: idx,
				})
			);

			const untouchedIssues = currentIssues.filter(
				(issue) =>
					issue.statusId !== fromStatusId && issue.statusId !== toStatusId
			);

			nextIssues = [
				...untouchedIssues,
				...sourceIssues,
				...normalizedDestinationIssues,
			];
		}

		// Apply optimistic update immediately for smooth animation
		setOptimisticIssues(nextIssues);

		try {
			await moveIssueStatus({ issueId, toStatusId, order });
			// Don't clear optimistic state - let Convex's natural reactivity handle it
			// The allIssues query will update automatically and replace optimisticIssues
		} catch (error) {
			// On error, revert immediately
			setOptimisticIssues(currentIssues);
			throw error;
		}
	};

	// ── Search filter is now handled by global search via boardSearchQuery ──

	// ── Old card/list handlers (table + gantt views) ─────────────────────────
	const handleAddCard = async (listId: Id<"lists">) => {
		if (!cardTitle.trim()) return;
		const cards = allCards.filter((c) => c.listId === listId) || [];
		await createCard({
			listId,
			title: cardTitle,
			description: cardDesc,
			order: cards.length,
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

	const _handleDeleteCard = async (cardId: Id<"cards">) => {
		await deleteCard({ cardId });
		setEditCardOpen(null);
	};

	const handleDeleteList = async () => {
		if (!listToDelete) return;
		await deleteList({ listId: listToDelete._id });
		setDeleteListOpen(false);
		setListToDelete(null);
	};

	// Card group by list (for table/gantt)
	const cardsByList: Record<
		string,
		{
			_id: Id<"cards">;
			title: string;
			description?: string;
			listId: Id<"lists">;
			order: number;
			labels?: string[];
			priority?: "lowest" | "low" | "medium" | "high" | "highest";
			dueDate?: number;
			assignees?: Id<"members">[];
			isCompleted?: boolean;
			estimate?: number;
			timeSpent?: number;
			watchers?: Id<"members">[];
			blockedBy?: Id<"cards">[];
		}[]
	> = {};
	allCards.forEach((card) => {
		if (!cardsByList[card.listId]) cardsByList[card.listId] = [];
		cardsByList[card.listId].push(card);
	});

	if (!channelId) return <div className="p-4">No channel selected.</div>;

	return (
		<div className="h-full w-full max-w-full flex flex-col bg-background dark:bg-gray-950 overflow-x-hidden overflow-y-hidden min-w-0">
			{view === "kanban" ? (
				statuses === undefined ? (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						Loading board…
					</div>
				) : (
					<BoardKanbanView
						issues={filteredIssues}
						members={members}
						onAddStatus={() => {
							setStatusName("");
							setStatusColor("#5e6ad2");
							setAddStatusOpen(true);
						}}
						onClickIssue={handleClickIssue}
						onCreateIssue={handleCreateIssue}
						onDeleteStatus={(status) => {
							setStatusToDelete(status);
							setDeleteStatusOpen(true);
						}}
						onEditStatus={(status) => {
							setStatusToEdit(status);
							setStatusName(status.name);
							setStatusColor(status.color);
							setEditStatusOpen(true);
						}}
						onMoveIssueStatus={handleMoveIssueStatus}
						onReorderStatuses={handleReorderStatuses}
						onReorderStatusesPersist={async (statusOrders) => {
							try {
								await reorderStatuses({ statusOrders });
								previousStatusOrderRef.current = null;
							} catch (error) {
								if (previousStatusOrderRef.current) {
									setOptimisticStatuses(previousStatusOrderRef.current);
								}
								console.error("Failed to persist status reorder:", error);
								toast.error("Failed to reorder statuses");
								throw error;
							}
						}}
						onSearchClick={() => {
							// Trigger global search open
							const event = new KeyboardEvent("keydown", {
								key: "k",
								ctrlKey: true,
								bubbles: true,
							});
							document.dispatchEvent(event);
						}}
						setView={setView}
						showHeader
						statusCount={displayedStatuses.length}
						statuses={displayedStatuses}
						totalIssues={filteredIssues.length}
						view={view}
					/>
				)
			) : (
				<BoardHeader
					onAddStatus={() => {
						setStatusName("");
						setStatusColor("#5e6ad2");
						setAddStatusOpen(true);
					}}
					onSearchClick={() => {
						// Trigger global search open
						const event = new KeyboardEvent("keydown", {
							key: "k",
							ctrlKey: true,
							bubbles: true,
						});
						document.dispatchEvent(event);
					}}
					setView={setView}
					statusCount={displayedStatuses.length}
					totalIssues={allCards.length}
					view={view}
				/>
			)}

			{view !== "kanban" && (
				<div className="flex-1 overflow-auto min-h-0">
					{/* ── Gantt (legacy cards) ─── */}
					{view === "gantt" && (
						<BoardGanttView
							allCards={allCards}
							lists={lists || []}
							members={members}
							readOnly
						/>
					)}
				</div>
			)}

			{/* ── Status modals ─────────────────────────────────────────────── */}
			<BoardAddStatusModal
				color={statusColor}
				name={statusName}
				onAdd={handleAddStatus}
				onOpenChange={setAddStatusOpen}
				open={addStatusOpen}
				setColor={setStatusColor}
				setName={setStatusName}
			/>
			<BoardEditStatusModal
				color={statusColor}
				name={statusName}
				onOpenChange={setEditStatusOpen}
				onSave={handleEditStatus}
				open={editStatusOpen}
				setColor={setStatusColor}
				setName={setStatusName}
			/>
			<BoardDeleteStatusModal
				onDelete={handleDeleteStatus}
				onOpenChange={setDeleteStatusOpen}
				open={deleteStatusOpen}
				statusName={statusToDelete?.name}
			/>

			{/* ── Issue drawer ───────────────────────────────────────────────── */}
			<BoardIssueDrawer
				allIssues={allIssues}
				issue={selectedIssue}
				members={members}
				onClickIssue={handleClickIssue}
				onDelete={() => setSelectedIssue(null)}
				onOpenChange={(open) => {
					setDrawerOpen(open);
					if (!open) setSelectedIssue(null);
				}}
				open={drawerOpen}
				statuses={displayedStatuses}
			/>

			{/* ── Legacy card modals (table/gantt) ──────────────────────────── */}
			<BoardDeleteListModal
				onDelete={handleDeleteList}
				onOpenChange={setDeleteListOpen}
				open={deleteListOpen}
			/>
			<BoardAddCardModal
				assignees={cardAssignees}
				description={cardDesc}
				dueDate={cardDueDate}
				labelSuggestions={uniqueLabels}
				labels={cardLabels}
				members={members}
				onAdd={() => addCardOpen && handleAddCard(addCardOpen)}
				onOpenChange={(open) => {
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
				open={Boolean(addCardOpen)}
				priority={cardPriority}
				setAssignees={setCardAssignees}
				setDescription={setCardDesc}
				setDueDate={setCardDueDate}
				setLabels={setCardLabels}
				setPriority={setCardPriority}
				setTitle={setCardTitle}
				title={cardTitle}
			/>
			<BoardEditCardModal
				assignees={cardAssignees}
				cardId={editCardOpen?.card._id as Id<"cards">}
				channelId={channelId}
				currentMemberId={currentMember?._id}
				description={cardDesc}
				dueDate={cardDueDate}
				estimate={editCardOpen?.card.estimate}
				labelSuggestions={uniqueLabels}
				labels={cardLabels}
				members={members}
				onOpenChange={(open) => {
					if (!open) setEditCardOpen(null);
				}}
				onSave={handleEditCard}
				open={Boolean(editCardOpen)}
				priority={cardPriority}
				setAssignees={setCardAssignees}
				setDescription={setCardDesc}
				setDueDate={setCardDueDate}
				setLabels={setCardLabels}
				setPriority={setCardPriority}
				setTitle={setCardTitle}
				timeSpent={editCardOpen?.card.timeSpent}
				title={cardTitle}
				watchers={editCardOpen?.card.watchers}
			/>
		</div>
	);
};

export default BoardPage;
