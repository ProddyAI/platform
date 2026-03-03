"use client";

import { useMutation, useQuery } from "convex/react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import BoardGanttView from "@/features/board/components/board-gantt-view";
import BoardHeader from "@/features/board/components/board-header";
import BoardIssueDrawer from "@/features/board/components/board-issue-drawer";
import BoardKanbanView from "@/features/board/components/board-kanban-view";
import {
	// Keep old card/list modals for table/gantt views
	BoardAddCardModal,
	BoardAddStatusModal,
	BoardDeleteListModal,
	BoardDeleteStatusModal,
	BoardEditCardModal,
	BoardEditStatusModal,
} from "@/features/board/components/board-models";
import BoardTableView from "@/features/board/components/board-table-view";
import { useChannelId } from "@/hooks/use-channel-id";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

const BoardPage = () => {
	const channelId = useChannelId();
	const workspaceId = useWorkspaceId();

	// ── New: issues & statuses ──────────────────────────────────────────────
	const statuses = useQuery(api.board.getStatuses, { channelId });
	const issues = useQuery(api.board.getIssues, { channelId }) || [];
	const _uniqueIssueLabels =
		useQuery(api.board.getUniqueIssueLabels, { channelId }) || [];

	// ── Existing: lists & cards (kept for table/gantt) ──────────────────────
	const lists = useQuery(api.board.getLists, { channelId });
	const allCards =
		useQuery(api.board.getAllCardsForChannel, { channelId }) || [];
	const uniqueLabels = useQuery(api.board.getUniqueLabels, { channelId }) || [];
	const members = useQuery(api.board.getMembersForChannel, { channelId }) || [];
	const channel = useQuery(api.channels.getById, { id: channelId });
	const currentMember = useQuery(api.members.current, { workspaceId });

	useDocumentTitle(channel ? `Board – ${channel.name}` : "Board");

	const [view, setView] = useState<"kanban" | "table" | "gantt">("kanban");
	const [searchQuery, setSearchQuery] = useState("");

	// ── Status modal state ──────────────────────────────────────────────────
	const [addStatusOpen, setAddStatusOpen] = useState(false);
	const [editStatusOpen, setEditStatusOpen] = useState(false);
	const [deleteStatusOpen, setDeleteStatusOpen] = useState(false);
	const [statusToEdit, setStatusToEdit] = useState<any>(null);
	const [statusToDelete, setStatusToDelete] = useState<any>(null);
	const [statusName, setStatusName] = useState("");
	const [statusColor, setStatusColor] = useState("#5e6ad2");

	// ── Issue drawer state ──────────────────────────────────────────────────
	const [drawerOpen, setDrawerOpen] = useState(false);
	const [selectedIssue, setSelectedIssue] = useState<any>(null);

	// ── Optimistic statuses (for drag reorder) ──────────────────────────────
	const [optimisticStatuses, setOptimisticStatuses] = useState<any[] | null>(
		null
	);
	const displayedStatuses = optimisticStatuses ?? statuses ?? [];

	// ── Old card modal state (for table/gantt views) ────────────────────────
	const [deleteListOpen, setDeleteListOpen] = useState(false);
	const [listToDelete, setListToDelete] = useState<any>(null);
	const [addCardOpen, setAddCardOpen] = useState<null | Id<"lists">>(null);
	const [editCardOpen, setEditCardOpen] = useState<null | { card: any }>();
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
	const _reorderStatuses = useMutation(api.board.reorderStatuses);
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
	};

	const handleEditStatus = async () => {
		if (!statusToEdit || !statusName.trim()) return;
		await updateStatus({
			statusId: statusToEdit._id,
			name: statusName.trim(),
			color: statusColor,
		});
		setEditStatusOpen(false);
		setStatusToEdit(null);
	};

	const handleDeleteStatus = async () => {
		if (!statusToDelete) return;
		await deleteStatus({ statusId: statusToDelete._id });
		setDeleteStatusOpen(false);
		setStatusToDelete(null);
	};

	// ── Issue handlers ──────────────────────────────────────────────────────
	const handleCreateIssue = async (statusId: Id<"statuses">, title: string) => {
		const statusIssues = issues.filter((i: any) => i.statusId === statusId);
		await createIssue({
			channelId,
			statusId,
			title,
			order: statusIssues.length,
		});
	};

	const handleClickIssue = (issue: any) => {
		setSelectedIssue(issue);
		setDrawerOpen(true);
	};

	// ── Reorder statuses (optimistic) ───────────────────────────────────────
	const handleReorderStatuses = (newOrder: any[]) => {
		setOptimisticStatuses(newOrder.map((s, idx) => ({ ...s, order: idx })));
	};

	// ── Search filter ───────────────────────────────────────────────────────
	const filteredIssues = issues.filter((issue: any) => {
		if (!searchQuery) return true;
		const q = searchQuery.toLowerCase();
		return (
			issue.title.toLowerCase().includes(q) ||
			issue.description?.toLowerCase().includes(q) ||
			issue.labels?.some((l: string) => l.toLowerCase().includes(q))
		);
	});

	// ── Old card/list handlers (table + gantt views) ─────────────────────────
	const handleAddCard = async (listId: Id<"lists">) => {
		if (!cardTitle.trim()) return;
		const cards = allCards.filter((c: any) => c.listId === listId) || [];
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

	const handleDeleteCard = async (cardId: Id<"cards">) => {
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
	const cardsByList: Record<string, any[]> = {};
	allCards.forEach((card: any) => {
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
						onReorderStatuses={handleReorderStatuses}
						onSearch={setSearchQuery}
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
					onSearch={setSearchQuery}
					setView={setView}
					statusCount={displayedStatuses.length}
					totalIssues={allCards.length}
					view={view}
				/>
			)}

			{view !== "kanban" && (
				<div className="flex-1 overflow-auto min-h-0">
					<BoardTableView
						allCards={allCards.filter((c: any) => {
							if (!searchQuery) return true;
							const q = searchQuery.toLowerCase();
							return (
								c.title.toLowerCase().includes(q) ||
								c.description?.toLowerCase().includes(q)
							);
						})}
						lists={lists || []}
						members={members}
						onDeleteCard={handleDeleteCard}
						onEditCard={(card) => {
							setEditCardOpen({ card });
							setCardTitle(card.title);
							setCardDesc(card.description || "");
							setCardLabels((card.labels || []).join(", "));
							setCardPriority(card.priority || "");
							setCardDueDate(card.dueDate ? new Date(card.dueDate) : undefined);
							setCardAssignees(card.assignees || []);
						}}
					/>

					{/* ── Gantt (legacy cards) ─── */}
					{view === "gantt" && (
						<BoardGanttView
							allCards={allCards}
							lists={lists || []}
							members={members}
							onDeleteCard={handleDeleteCard}
							onEditCard={(card) => {
								setEditCardOpen({ card });
								setCardTitle(card.title);
								setCardDesc(card.description || "");
								setCardLabels((card.labels || []).join(", "));
								setCardPriority(card.priority || "");
								setCardDueDate(
									card.dueDate ? new Date(card.dueDate) : undefined
								);
								setCardAssignees(card.assignees || []);
							}}
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
				issue={selectedIssue}
				members={members}
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
