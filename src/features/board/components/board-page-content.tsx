"use client";

import { useMutation, useQuery } from "convex/react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { LimitIndicator } from "@/components/limit-indicator";
import {
	BoardAddStatusModal,
	BoardDeleteStatusModal,
	BoardEditStatusModal,
} from "@/features/board/components/board-card-edit-dialog";
import BoardHeader from "@/features/board/components/board-header";
import BoardIssueDrawer from "@/features/board/components/board-issue-drawer";
import BoardKanbanView from "@/features/board/components/board-kanban-view";
import BoardLinkageDiagram from "@/features/board/components/board-linkage-diagram";
import { useBoardSearchStore } from "@/features/board/store/use-board-search";
import { useConnectProjectChannelModal } from "@/features/projects/store/use-connect-project-channel-modal";
import { useWorkspaceSearch } from "@/features/workspaces/store/use-workspace-search";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useWorkspaceLimit } from "@/hooks/use-workspace-limit";

interface BoardPageContentProps {
	channelId: Id<"channels">;
	projectId?: Id<"projects">;
	projectConnectedChannelName?: string;
	isProjectChannelConnected?: boolean;
}

export const BoardPageContent = ({
	channelId,
	projectId,
	projectConnectedChannelName,
	isProjectChannelConnected = false,
}: BoardPageContentProps) => {
	const workspaceId = useWorkspaceId();
	const searchParams = useSearchParams();
	const [, setConnectProjectChannelModal] = useConnectProjectChannelModal();
	const { maxReached: boardLimitReached } = useWorkspaceLimit("board");
	const [, setSearchOpen] = useWorkspaceSearch();

	// Board search store integration
	const {
		setIsBoardPage,
		setBoardSearchQuery,
		setBoardSearchChannelId,
		boardSearchQuery,
	} = useBoardSearchStore();

	// ── New: issues & statuses ──────────────────────────────────────────────
	const statuses = useQuery(api.board.board.getStatuses, { channelId });
	const allIssues = useQuery(api.board.board.getIssues, { channelId }) || [];
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

	const members =
		useQuery(api.board.board.getMembersForChannel, { channelId }) || [];
	const channel = useQuery(api.messaging.channels.getById, { id: channelId });
	const currentMember = useQuery(api.workspace.members.current, {
		workspaceId,
	});
	const canManageProjectConnection =
		Boolean(projectId) &&
		(currentMember?.role === "admin" || currentMember?.role === "owner");

	const handleConnectProjectChannel = () => {
		if (!projectId) {
			return;
		}

		setConnectProjectChannelModal({
			open: true,
			projectId,
		});
	};

	useDocumentTitle(channel ? `Board – ${channel.name}` : "Board");

	const [view, setView] = useState<"kanban" | "gantt">("kanban");
	const [analyzeBlockersLoading, setAnalyzeBlockersLoading] = useState(false);

	const handleAnalyzeBlockers = async () => {
		setAnalyzeBlockersLoading(true);
		try {
			const res = await fetch("/api/analyze-blockers", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ channelId }),
			});
			const data = (await res.json()) as
				| { ok: true; applied: number }
				| { error: string; details?: string };
			if (!res.ok || "error" in data) {
				throw new Error(
					"error" in data ? data.error : "Failed to analyze blockers"
				);
			}
			toast.success(
				data.applied === 1
					? "Applied 1 dependency"
					: `Applied ${data.applied} dependencies`
			);
		} catch (error) {
			console.error("Analyze blockers failed:", error);
			toast.error(
				error instanceof Error ? error.message : "Failed to analyze blockers"
			);
		} finally {
			setAnalyzeBlockersLoading(false);
		}
	};

	// Set board page flag for global search
	useEffect(() => {
		setIsBoardPage(true);
		setBoardSearchChannelId(channelId);
		return () => {
			setIsBoardPage(false);
			setBoardSearchQuery("");
			setBoardSearchChannelId(null);
		};
	}, [channelId, setBoardSearchChannelId, setIsBoardPage, setBoardSearchQuery]);

	const displayedIssues = optimisticIssues ?? allIssues;
	const isFilteredBoardView = boardSearchQuery.trim().length > 0;

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
	const [linkageDiagramOpen, setLinkageDiagramOpen] = useState(false);
	const [focusedStatusId, setFocusedStatusId] = useState<Id<"statuses"> | null>(
		null
	);
	const handledFocusIssueRef = useRef<string | null>(null);
	const handledFocusStatusRef = useRef<string | null>(null);
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

	// ── Mutations ───────────────────────────────────────────────────────────
	const migrate = useMutation(api.board.board.migrateListsToStatuses);
	const createStatus = useMutation(api.board.board.createStatus);
	const updateStatus = useMutation(api.board.board.updateStatus);
	const deleteStatus = useMutation(api.board.board.deleteStatus);
	const reorderStatuses = useMutation(api.board.board.reorderStatuses);
	const moveIssueStatus = useMutation(api.board.board.moveIssueStatus);
	const createIssue = useMutation(api.board.board.createIssue);

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

	useEffect(() => {
		const focusIssue = searchParams.get("focusIssue");
		if (!focusIssue || handledFocusIssueRef.current === focusIssue) return;
		if (allIssues.length === 0) return;

		const issue = allIssues.find((candidate) => candidate._id === focusIssue);
		if (issue) {
			handledFocusIssueRef.current = focusIssue;
			setSelectedIssue(issue);
			setDrawerOpen(true);
		}
	}, [allIssues, searchParams]);

	useEffect(() => {
		const focusStatus = searchParams.get("focusStatus");
		if (!focusStatus || handledFocusStatusRef.current === focusStatus)
			return undefined;
		if (!displayedStatuses.some((status) => status._id === focusStatus))
			return undefined;

		handledFocusStatusRef.current = focusStatus;
		setFocusedStatusId(focusStatus as Id<"statuses">);

		const timeoutId = window.setTimeout(() => {
			setFocusedStatusId((current) =>
				current === focusStatus ? null : current
			);
		}, 2500);

		return () => window.clearTimeout(timeoutId);
	}, [displayedStatuses, searchParams]);

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

	const handleCreateIssue = async (statusId: Id<"statuses">, title: string) => {
		if (boardLimitReached) {
			toast.error(
				"Board cards limit reached. Upgrade your plan to create more."
			);
			return;
		}
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

	if (!channelId) {
		return (
			<div className="flex h-full items-center justify-center text-sm text-muted-foreground">
				No channel selected.
			</div>
		);
	}

	return (
		<div className="h-full w-full max-w-full flex flex-col bg-background overflow-x-hidden overflow-y-hidden min-w-0">
			{boardLimitReached && (
				<div className="flex-shrink-0 m-4 flex items-center justify-between rounded-xl border border-warning/30 bg-warning/10 p-2.5 text-xs text-warning">
					<span>
						You have reached the board card limit for your plan. Upgrade to
						create more cards/issues.
					</span>
					<LimitIndicator featureLabel="Board Cards" />
				</div>
			)}
			{view === "kanban" ? (
				statuses === undefined ? (
					<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
						Loading board…
					</div>
				) : (
					<BoardKanbanView
						analyzeBlockersLoading={analyzeBlockersLoading}
						channelId={channelId}
						connectedChannelName={projectConnectedChannelName}
						disableCreateIssue={boardLimitReached}
						disableIssueDrag={isFilteredBoardView}
						focusedStatusId={focusedStatusId}
						isProjectChannelConnected={isProjectChannelConnected}
						issues={filteredIssues}
						members={members}
						onAddStatus={() => {
							setStatusName("");
							setStatusColor("#5e6ad2");
							setAddStatusOpen(true);
						}}
						onAnalyzeBlockersClick={handleAnalyzeBlockers}
						onClickIssue={handleClickIssue}
						onConnectChannelClick={
							canManageProjectConnection
								? handleConnectProjectChannel
								: undefined
						}
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
						onLinkageDiagramClick={() => setLinkageDiagramOpen(true)}
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
						onSearchClick={() => setSearchOpen(true)}
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
					analyzeBlockersLoading={analyzeBlockersLoading}
					connectedChannelName={projectConnectedChannelName}
					isProjectChannelConnected={isProjectChannelConnected}
					onAddStatus={() => {
						setStatusName("");
						setStatusColor("#5e6ad2");
						setAddStatusOpen(true);
					}}
					onAnalyzeBlockersClick={handleAnalyzeBlockers}
					onConnectChannelClick={
						canManageProjectConnection ? handleConnectProjectChannel : undefined
					}
					onLinkageDiagramClick={() => setLinkageDiagramOpen(true)}
					onSearchClick={() => setSearchOpen(true)}
					setView={setView}
					statusCount={displayedStatuses.length}
					totalIssues={filteredIssues.length}
					view={view}
				/>
			)}

			{view === "gantt" && (
				<div className="flex flex-1 flex-col items-center justify-center gap-1.5 overflow-auto p-8 text-center min-h-0">
					<p className="text-sm font-medium text-foreground">
						Timeline view is temporarily unavailable
					</p>
					<p className="max-w-sm text-sm text-muted-foreground">
						It's being rebuilt to work with your current issues. Switch to Board
						view to see and manage them.
					</p>
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

			<BoardLinkageDiagram
				channelId={channelId}
				onOpenChange={setLinkageDiagramOpen}
				open={linkageDiagramOpen}
			/>
		</div>
	);
};

export default BoardPageContent;
