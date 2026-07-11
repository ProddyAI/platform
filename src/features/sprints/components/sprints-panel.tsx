"use client";

import { format } from "date-fns";
import { CheckCircle, Clock, ListTodo, Plus, Zap } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetSprints } from "../api/use-get-sprints";
import { useRolloverSprint } from "../api/use-sprint-mutations";
import { CreateSprintModal } from "./create-sprint-modal";
import { SprintCard } from "./sprint-card";
import { SprintDetail } from "./sprint-detail";

type SprintFilter = "all" | Doc<"sprints">["status"];

const SPRINT_STATUSES: Doc<"sprints">["status"][] = [
	"planning",
	"active",
	"completed",
	"cancelled",
];

const isSprintStatus = (
	value: string | null
): value is Doc<"sprints">["status"] =>
	value !== null && (SPRINT_STATUSES as string[]).includes(value);

interface SprintsPanelProps {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const SprintsPanel = ({ projectId, workspaceId }: SprintsPanelProps) => {
	const { data: sprints, isLoading } = useGetSprints({
		projectId,
		workspaceId,
	});
	const { mutate: rollover, isPending: isRollingOver } = useRolloverSprint();

	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [createOpen, setCreateOpen] = useState(false);
	const [rolloverSourceId, setRolloverSourceId] =
		useState<Id<"sprints"> | null>(null);

	// Selection and filter live in the URL (not component state) so sprint
	// detail views are deep-linkable and browser Back returns to the list
	// instead of leaving the module.
	const selectedSprintId = searchParams.get("sprint") as Id<"sprints"> | null;
	const statusParam = searchParams.get("status");
	const filter: SprintFilter = isSprintStatus(statusParam)
		? statusParam
		: "all";

	const buildQuery = (updates: Record<string, string | null>) => {
		const params = new URLSearchParams(searchParams.toString());
		for (const [key, value] of Object.entries(updates)) {
			if (value === null) {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}
		const query = params.toString();
		return query ? `${pathname ?? ""}?${query}` : (pathname ?? "");
	};

	const setFilter = (next: SprintFilter) => {
		router.replace(buildQuery({ status: next === "all" ? null : next }), {
			scroll: false,
		});
	};

	const openSprint = (sprintId: Id<"sprints">) => {
		router.push(buildQuery({ sprint: sprintId }), { scroll: false });
	};

	const closeSprint = () => {
		router.push(buildQuery({ sprint: null }), { scroll: false });
	};

	const selectedSprint = sprints?.find(
		(sprint) => sprint._id === selectedSprintId
	);
	const filtered = sprints?.filter((sprint) =>
		filter === "all" ? true : sprint.status === filter
	);
	const countOf = (status: Doc<"sprints">["status"]) =>
		sprints?.filter((sprint) => sprint.status === status).length ?? 0;

	const rolloverSource = sprints?.find(
		(sprint) => sprint._id === rolloverSourceId
	);
	const rolloverTargets =
		sprints?.filter(
			(sprint) =>
				sprint._id !== rolloverSourceId && sprint.status === "planning"
		) ?? [];

	const handleRolloverConfirm = async (toSprintId: Id<"sprints">) => {
		if (!rolloverSourceId) return;
		const target = sprints?.find((sprint) => sprint._id === toSprintId);
		try {
			const result = await rollover({
				fromSprintId: rolloverSourceId,
				toSprintId,
			});
			toast.success(
				`Rolled over ${result?.rolledOver ?? 0} incomplete issues to ${
					target?.name ?? "the sprint"
				}`
			);
			setRolloverSourceId(null);
		} catch {
			toast.error("Rollover failed");
		}
	};

	const pillClass = (status: Doc<"sprints">["status"]) =>
		cn(
			"flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs transition-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			filter === status && "border-primary/50 bg-primary/10"
		);

	if (selectedSprint) {
		return <SprintDetail onBack={closeSprint} sprint={selectedSprint} />;
	}

	const hasSprints = !isLoading && sprints && sprints.length > 0;

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b p-4">
				<div>
					<h1 className="font-semibold text-lg">Sprints</h1>
					<p className="text-muted-foreground text-xs">
						Plan and track time-boxed iterations
					</p>
				</div>
				<Button onClick={() => setCreateOpen(true)} size="sm">
					<Plus className="mr-1 size-4" />
					New sprint
				</Button>
			</div>

			{hasSprints && (
				<div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
					<button
						aria-pressed={filter === "active"}
						className={pillClass("active")}
						onClick={() => setFilter(filter === "active" ? "all" : "active")}
						type="button"
					>
						<Zap className="size-3 text-primary" />
						<span className="font-medium">{countOf("active")}</span>
						<span className="text-muted-foreground">active</span>
					</button>
					<button
						aria-pressed={filter === "planning"}
						className={pillClass("planning")}
						onClick={() =>
							setFilter(filter === "planning" ? "all" : "planning")
						}
						type="button"
					>
						<ListTodo className="size-3 text-muted-foreground" />
						<span className="font-medium">{countOf("planning")}</span>
						<span className="text-muted-foreground">planning</span>
					</button>
					<button
						aria-pressed={filter === "completed"}
						className={pillClass("completed")}
						onClick={() =>
							setFilter(filter === "completed" ? "all" : "completed")
						}
						type="button"
					>
						<CheckCircle className="size-3 text-success" />
						<span className="font-medium">{countOf("completed")}</span>
						<span className="text-muted-foreground">completed</span>
					</button>

					<Select
						onValueChange={(value) => setFilter(value as SprintFilter)}
						value={filter}
					>
						<SelectTrigger className="ml-auto h-8 w-36 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All sprints</SelectItem>
							<SelectItem value="active">Active</SelectItem>
							<SelectItem value="planning">Planning</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="cancelled">Cancelled</SelectItem>
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="flex-1 overflow-auto p-4">
				{isLoading ? (
					<div className="space-y-3">
						{/* Fixed-size decorative placeholders with no underlying data (JS-0437 exemption) — index is a safe key here */}
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton className="h-36 w-full rounded-2xl" key={index} />
						))}
					</div>
				) : !filtered || filtered.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<EmptyState
							action={
								filter === "all"
									? {
											label: "Create sprint",
											icon: Plus,
											onClick: () => setCreateOpen(true),
										}
									: undefined
							}
							description={
								filter === "all"
									? "Create your first sprint to start planning."
									: `No sprints with status “${filter}” found.`
							}
							icon={Clock}
							size="sm"
							title={
								filter === "all" ? "No sprints yet" : `No ${filter} sprints`
							}
						/>
					</div>
				) : (
					<div className="space-y-3">
						{filtered.map((sprint) => (
							<SprintCard
								key={sprint._id}
								onClick={() => openSprint(sprint._id)}
								onRollover={setRolloverSourceId}
								sprint={sprint}
							/>
						))}
					</div>
				)}
			</div>

			<CreateSprintModal
				onClose={() => setCreateOpen(false)}
				open={createOpen}
				projectId={projectId}
				sprintNumber={(sprints?.length ?? 0) + 1}
				workspaceId={workspaceId}
			/>

			<Dialog
				onOpenChange={(open) => !open && setRolloverSourceId(null)}
				open={!!rolloverSourceId}
			>
				<DialogContent className="sm:max-w-sm">
					<DialogHeader>
						<DialogTitle>Roll over incomplete issues</DialogTitle>
						<DialogDescription>
							{rolloverSource
								? `Choose a planning sprint to move ${rolloverSource.name}'s incomplete issues into.`
								: "Choose a planning sprint to move the incomplete issues into."}
						</DialogDescription>
					</DialogHeader>

					{rolloverTargets.length === 0 ? (
						<div className="space-y-3 py-2 text-center">
							<p className="text-muted-foreground text-sm">
								Create another planning sprint to roll issues into first.
							</p>
							<Button
								onClick={() => {
									setRolloverSourceId(null);
									setCreateOpen(true);
								}}
								size="sm"
								variant="outline"
							>
								<Plus className="mr-1 size-4" />
								New sprint
							</Button>
						</div>
					) : (
						<div className="space-y-1.5 py-1">
							{rolloverTargets.map((sprint) => (
								<button
									className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50"
									disabled={isRollingOver}
									key={sprint._id}
									onClick={() => handleRolloverConfirm(sprint._id)}
									type="button"
								>
									<span className="font-medium">{sprint.name}</span>
									<span className="text-muted-foreground text-xs">
										{format(new Date(sprint.startDate), "MMM d")} →{" "}
										{format(new Date(sprint.endDate), "MMM d")}
									</span>
								</button>
							))}
						</div>
					)}
				</DialogContent>
			</Dialog>
		</div>
	);
};
