"use client";

import { format } from "date-fns";
import { Flag, GanttChartSquare, LayoutGrid, Plus } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";

import type { Doc, Id } from "@/../convex/_generated/dataModel";
import { EmptyState } from "@/components/empty-state";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useGetMilestones } from "../api/use-milestones";
import { CreateMilestoneModal } from "./create-milestone-modal";
import { MilestoneCard } from "./milestone-card";
import { MilestoneDetail } from "./milestone-detail";

type StatusFilter = "all" | Doc<"milestones">["status"];
type RoadmapView = "timeline" | "grid";

const DEFAULT_COLOR = "#6366f1";
const DEFAULT_VIEW: RoadmapView = "timeline";
const DEFAULT_FILTER: StatusFilter = "all";

const formatMonthLabel = (targetDate: number | undefined) =>
	targetDate ? format(new Date(targetDate), "MMMM yyyy") : "No target date";

// Orders milestones chronologically by target date (undated milestones last)
// and marks the first entry in each month so the timeline can render as a
// real date axis instead of an arbitrary stacked list.
const buildTimelineEntries = (milestones: Doc<"milestones">[]) => {
	const sorted = [...milestones].sort((a, b) => {
		if (a.targetDate == null && b.targetDate == null) return 0;
		if (a.targetDate == null) return 1;
		if (b.targetDate == null) return -1;
		return a.targetDate - b.targetDate;
	});
	let lastLabel: string | null = null;
	return sorted.map((milestone) => {
		const label = formatMonthLabel(milestone.targetDate);
		const groupLabel = label === lastLabel ? undefined : label;
		lastLabel = label;
		return { milestone, groupLabel };
	});
};

interface RoadmapPanelProps {
	projectId: Id<"projects">;
	workspaceId: Id<"workspaces">;
}

export const RoadmapPanel = ({ projectId, workspaceId }: RoadmapPanelProps) => {
	const { data: milestones, isLoading } = useGetMilestones({
		projectId,
		workspaceId,
	});

	const router = useRouter();
	const pathname = usePathname();
	const searchParams = useSearchParams();

	const [createOpen, setCreateOpen] = useState(false);

	// View, status filter, and the open milestone all live in the URL so the
	// detail view is deep-linkable, survives a refresh, and browser Back
	// closes it instead of leaving the roadmap module entirely.
	const view = (searchParams.get("view") as RoadmapView | null) ?? DEFAULT_VIEW;
	const filter =
		(searchParams.get("status") as StatusFilter | null) ?? DEFAULT_FILTER;
	const selectedId = searchParams.get("milestone") as Id<"milestones"> | null;

	const updateParams = (
		updates: Record<string, string | null>,
		mode: "push" | "replace" = "replace"
	) => {
		const params = new URLSearchParams(searchParams.toString());
		for (const [key, value] of Object.entries(updates)) {
			if (value === null) {
				params.delete(key);
			} else {
				params.set(key, value);
			}
		}
		const query = params.toString();
		const url = query ? `${pathname}?${query}` : pathname;
		if (mode === "push") {
			router.push(url);
		} else {
			router.replace(url);
		}
	};

	const setView = (next: RoadmapView) =>
		updateParams({ view: next === DEFAULT_VIEW ? null : next });
	const setFilter = (next: StatusFilter) =>
		updateParams({ status: next === DEFAULT_FILTER ? null : next });
	const selectMilestone = (id: Id<"milestones">) =>
		updateParams({ milestone: id }, "push");
	const closeMilestone = () => updateParams({ milestone: null }, "push");

	const selected = milestones?.find(
		(milestone) => milestone._id === selectedId
	);
	const filtered = milestones?.filter((milestone) =>
		filter === "all" ? true : milestone.status === filter
	);
	const countOf = (status: Doc<"milestones">["status"]) =>
		milestones?.filter((milestone) => milestone.status === status).length ?? 0;

	if (selected) {
		return <MilestoneDetail milestone={selected} onBack={closeMilestone} />;
	}

	const hasMilestones = !isLoading && milestones && milestones.length > 0;
	const timelineEntries =
		view === "timeline" && filtered ? buildTimelineEntries(filtered) : [];

	const pillClass = (status: StatusFilter) =>
		cn(
			"flex items-center gap-1.5 rounded-full border bg-card px-2.5 py-1 text-xs transition-standard hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
			filter === status && "border-primary/50 bg-primary/10"
		);

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center justify-between border-b p-4">
				<div>
					<h1 className="font-semibold text-lg">Roadmap</h1>
					<p className="text-muted-foreground text-xs">
						Strategic milestones and long-term goals
					</p>
				</div>
				<div className="flex items-center gap-2">
					<div className="flex items-center rounded-md border p-0.5">
						<Button
							className="size-7"
							onClick={() => setView("timeline")}
							size="icon"
							variant={view === "timeline" ? "secondary" : "ghost"}
						>
							<GanttChartSquare className="size-4" />
						</Button>
						<Button
							className="size-7"
							onClick={() => setView("grid")}
							size="icon"
							variant={view === "grid" ? "secondary" : "ghost"}
						>
							<LayoutGrid className="size-4" />
						</Button>
					</div>
					<Button onClick={() => setCreateOpen(true)} size="sm">
						<Plus className="mr-1 size-4" />
						New milestone
					</Button>
				</div>
			</div>

			{hasMilestones && (
				<div className="flex flex-wrap items-center gap-2 border-b bg-muted/30 px-4 py-2.5">
					<button
						aria-pressed={filter === "planned"}
						className={pillClass("planned")}
						onClick={() => setFilter(filter === "planned" ? "all" : "planned")}
						type="button"
					>
						<span className="inline-block size-1.5 rounded-full bg-muted-foreground/40" />
						<span className="font-medium">{countOf("planned")}</span>
						<span className="text-muted-foreground">planned</span>
					</button>
					<button
						aria-pressed={filter === "in_progress"}
						className={pillClass("in_progress")}
						onClick={() =>
							setFilter(filter === "in_progress" ? "all" : "in_progress")
						}
						type="button"
					>
						<span className="inline-block size-1.5 rounded-full bg-primary" />
						<span className="font-medium">{countOf("in_progress")}</span>
						<span className="text-muted-foreground">in progress</span>
					</button>
					<button
						aria-pressed={filter === "completed"}
						className={pillClass("completed")}
						onClick={() =>
							setFilter(filter === "completed" ? "all" : "completed")
						}
						type="button"
					>
						<span className="inline-block size-1.5 rounded-full bg-success" />
						<span className="font-medium">{countOf("completed")}</span>
						<span className="text-muted-foreground">completed</span>
					</button>

					<Select
						onValueChange={(value) => setFilter(value as StatusFilter)}
						value={filter}
					>
						<SelectTrigger className="ml-auto h-8 w-40 text-xs">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="all">All milestones</SelectItem>
							<SelectItem value="planned">Planned</SelectItem>
							<SelectItem value="in_progress">In progress</SelectItem>
							<SelectItem value="completed">Completed</SelectItem>
							<SelectItem value="archived">Archived</SelectItem>
						</SelectContent>
					</Select>
				</div>
			)}

			<div className="flex-1 overflow-auto p-4">
				{isLoading ? (
					<div className="space-y-3">
						{/* Fixed-size decorative placeholders with no underlying data (JS-0437 exemption) — index is a safe key here */}
						{Array.from({ length: 3 }).map((_, index) => (
							<Skeleton className="h-40 w-full rounded-2xl" key={index} />
						))}
					</div>
				) : !filtered || filtered.length === 0 ? (
					<div className="flex h-full items-center justify-center">
						<EmptyState
							action={
								filter === "all"
									? {
											label: "Create milestone",
											icon: Plus,
											onClick: () => setCreateOpen(true),
										}
									: undefined
							}
							description={
								filter === "all"
									? "Define milestones to map out your product roadmap."
									: "No milestones with this status found."
							}
							icon={Flag}
							size="sm"
							title={
								filter === "all"
									? "No milestones yet"
									: `No ${filter.replace("_", " ")} milestones`
							}
						/>
					</div>
				) : view === "grid" ? (
					<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
						{filtered.map((milestone) => (
							<MilestoneCard
								key={milestone._id}
								milestone={milestone}
								onClick={() => selectMilestone(milestone._id)}
							/>
						))}
					</div>
				) : (
					<div className="relative pl-8">
						<span className="absolute top-2 bottom-2 left-[11px] w-px bg-border" />
						<div className="space-y-3">
							{timelineEntries.map(({ milestone, groupLabel }) => (
								<div key={milestone._id}>
									{groupLabel && (
										<p className="mb-2 font-medium text-muted-foreground text-xs uppercase tracking-wide">
											{groupLabel}
										</p>
									)}
									<div className="relative">
										<span
											className="absolute top-4 left-[-23px] size-2.5 rounded-full ring-2 ring-background"
											style={{
												backgroundColor: milestone.color ?? DEFAULT_COLOR,
											}}
										/>
										<MilestoneCard
											milestone={milestone}
											onClick={() => selectMilestone(milestone._id)}
										/>
									</div>
								</div>
							))}
						</div>
					</div>
				)}
			</div>

			<CreateMilestoneModal
				onClose={() => setCreateOpen(false)}
				open={createOpen}
				projectId={projectId}
				workspaceId={workspaceId}
			/>
		</div>
	);
};
