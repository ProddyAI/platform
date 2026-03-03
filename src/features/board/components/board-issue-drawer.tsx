"use client";

import { useMutation } from "convex/react";
import { format } from "date-fns";
import { Calendar, CalendarIcon, ChevronRight, Trash2, X } from "lucide-react";
import type React from "react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import MemberSelector from "@/components/member-selector";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { IssuePriority } from "./board-issue-row";
import { formatIssueId, priorityIcon, priorityLabel } from "./board-issue-row";

interface Status {
	_id: Id<"statuses">;
	name: string;
	color: string;
	order: number;
}

interface Issue {
	_id: Id<"issues">;
	channelId: Id<"channels">;
	statusId: Id<"statuses">;
	title: string;
	description?: string;
	priority?: IssuePriority;
	assignees?: Id<"members">[];
	labels?: string[];
	dueDate?: number;
	createdAt: number;
	updatedAt: number;
	order: number;
}

interface BoardIssueDrawerProps {
	issue: Issue | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	statuses: Status[];
	members: any[];
	onDelete?: (issueId: Id<"issues">) => void;
}

const PRIORITIES: IssuePriority[] = [
	"urgent",
	"high",
	"medium",
	"low",
	"no_priority",
];

/** A single labelled property row */
const PropertyRow = ({
	label,
	children,
	alignTop = false,
}: {
	label: string;
	children: React.ReactNode;
	alignTop?: boolean;
}) => (
	<div className={cn("flex gap-4", alignTop ? "items-start" : "items-center")}>
		<span className="w-24 flex-shrink-0 text-xs font-medium text-muted-foreground">
			{label}
		</span>
		<div className="flex-1 min-w-0">{children}</div>
	</div>
);

const BoardIssueDrawer: React.FC<BoardIssueDrawerProps> = ({
	issue,
	open,
	onOpenChange,
	statuses,
	members,
	onDelete,
}) => {
	const updateIssue = useMutation(api.board.updateIssue);
	const deleteIssue = useMutation(api.board.deleteIssue);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [statusId, setStatusId] = useState<Id<"statuses"> | "">("");
	const [priority, setPriority] = useState<IssuePriority>("no_priority");
	const [assignees, setAssignees] = useState<Id<"members">[]>([]);
	const [labels, setLabels] = useState<string[]>([]);
	const [labelInput, setLabelInput] = useState("");
	const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
	const [saving, setSaving] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	useEffect(() => {
		if (issue) {
			setTitle(issue.title);
			setDescription(issue.description || "");
			setStatusId(issue.statusId);
			setPriority(issue.priority || "no_priority");
			setAssignees(issue.assignees || []);
			setLabels(issue.labels || []);
			setDueDate(issue.dueDate ? new Date(issue.dueDate) : undefined);
			setConfirmDelete(false);
		}
	}, [issue]);

	if (!issue) return null;

	const currentStatus = statuses.find((s) => s._id === statusId);

	const handleSave = async () => {
		if (!issue || !title.trim()) return;
		setSaving(true);
		try {
			await updateIssue({
				issueId: issue._id,
				title: title.trim(),
				description: description.trim() || undefined,
				statusId: (statusId as Id<"statuses">) || issue.statusId,
				priority,
				assignees: assignees.length > 0 ? assignees : [],
				labels,
				dueDate: dueDate ? dueDate.getTime() : undefined,
			});
		} finally {
			setSaving(false);
		}
	};

	const handleStatusChange = async (newStatusId: string) => {
		setStatusId(newStatusId as Id<"statuses">);
		if (!issue) return;
		await updateIssue({
			issueId: issue._id,
			statusId: newStatusId as Id<"statuses">,
		});
	};

	const handlePriorityChange = async (val: string) => {
		const p = val as IssuePriority;
		setPriority(p);
		await updateIssue({ issueId: issue._id, priority: p });
	};

	const handleDelete = async () => {
		if (!confirmDelete) {
			setConfirmDelete(true);
			setTimeout(() => setConfirmDelete(false), 3000);
			return;
		}
		await deleteIssue({ issueId: issue._id });
		onOpenChange(false);
		onDelete?.(issue._id);
	};

	const handleAddLabel = () => {
		const trimmed = labelInput.trim();
		if (trimmed && !labels.includes(trimmed)) {
			setLabels([...labels, trimmed]);
			setLabelInput("");
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="w-full sm:max-w-[580px] p-0 flex flex-col gap-0 border-l border-border/60 dark:border-gray-800 overflow-hidden"
				showCloseButton={false}
				side="right"
			>
				{/* ── Header ── */}
				<div className="flex items-center justify-between px-5 py-3 border-b border-border/50 dark:border-gray-800/80 bg-muted/20 dark:bg-gray-900/50 shrink-0">
					{/* Breadcrumb trail */}
					<div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
						{currentStatus && (
							<>
								<span
									className="w-2 h-2 rounded-full flex-shrink-0"
									style={{ backgroundColor: currentStatus.color }}
								/>
								<span className="truncate max-w-[120px]">
									{currentStatus.name}
								</span>
								<ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
							</>
						)}
						<span className="font-mono text-muted-foreground/70 flex-shrink-0">
							{formatIssueId(issue._id)}
						</span>
					</div>

					{/* Actions */}
					<div className="flex items-center gap-0.5 shrink-0">
						{confirmDelete ? (
							<span className="text-[11px] text-destructive mr-2 font-medium">
								Click again to confirm
							</span>
						) : null}
						<Button
							className={cn(
								"h-8 w-8 rounded-lg transition-colors",
								confirmDelete
									? "bg-destructive/10 text-destructive hover:bg-destructive/20"
									: "hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
							)}
							onClick={handleDelete}
							size="icon"
							title="Delete issue"
							variant="ghost"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</Button>
						<Button
							className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
							onClick={() => onOpenChange(false)}
							size="icon"
							title="Close"
							variant="ghost"
						>
							<X className="w-4 h-4" />
						</Button>
					</div>
				</div>

				{/* ── Scrollable body ── */}
				<div className="flex-1 overflow-y-auto">
					<div className="px-6 py-5 space-y-5">
						{/* Title */}
						<textarea
							className="w-full text-[22px] font-semibold bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/30 leading-snug"
							onBlur={handleSave}
							onChange={(e) => setTitle(e.target.value)}
							placeholder="Issue title"
							rows={title.length > 55 ? 2 : 1}
							value={title}
						/>

						{/* Description */}
						<Textarea
							className="min-h-[90px] text-sm bg-muted/20 dark:bg-gray-800/20 border-border/30 resize-none focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/40"
							onBlur={handleSave}
							onChange={(e) => setDescription(e.target.value)}
							placeholder="Add a description..."
							value={description}
						/>

						<Separator className="opacity-40" />

						{/* Properties */}
						<div className="space-y-3">
							{/* Status */}
							<PropertyRow label="Status">
								<Select onValueChange={handleStatusChange} value={statusId}>
									<SelectTrigger className="h-8 text-xs border-border/30 bg-transparent hover:bg-muted/40 focus:ring-1 focus:ring-primary/30">
										<SelectValue placeholder="Set status">
											{currentStatus && (
												<span className="flex items-center gap-2">
													<span
														className="w-2 h-2 rounded-full flex-shrink-0"
														style={{ backgroundColor: currentStatus.color }}
													/>
													{currentStatus.name}
												</span>
											)}
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{statuses.map((s) => (
											<SelectItem className="text-xs" key={s._id} value={s._id}>
												<span className="flex items-center gap-2">
													<span
														className="w-2 h-2 rounded-full flex-shrink-0"
														style={{ backgroundColor: s.color }}
													/>
													{s.name}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</PropertyRow>

							{/* Priority */}
							<PropertyRow label="Priority">
								<Select onValueChange={handlePriorityChange} value={priority}>
									<SelectTrigger className="h-8 text-xs border-border/30 bg-transparent hover:bg-muted/40 focus:ring-1 focus:ring-primary/30">
										<SelectValue placeholder="Set priority">
											<span className="flex items-center gap-2">
												{priorityIcon(priority, "w-3.5 h-3.5")}
												{priorityLabel(priority)}
											</span>
										</SelectValue>
									</SelectTrigger>
									<SelectContent>
										{PRIORITIES.map((p) => (
											<SelectItem className="text-xs" key={p} value={p}>
												<span className="flex items-center gap-2">
													{priorityIcon(p, "w-3.5 h-3.5")}
													{priorityLabel(p)}
												</span>
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</PropertyRow>

							{/* Assignees */}
							<PropertyRow alignTop label="Assignees">
								<MemberSelector
									members={members}
									onChange={(ids) => setAssignees(ids)}
									placeholder="Assign members"
									selectedMemberIds={assignees}
								/>
							</PropertyRow>

							{/* Due date */}
							<PropertyRow label="Due date">
								<Popover>
									<PopoverTrigger asChild>
										<Button
											className={cn(
												"h-8 w-full text-xs justify-start font-normal px-3 border border-border/30 hover:bg-muted/40 focus:ring-1 focus:ring-primary/30",
												!dueDate && "text-muted-foreground"
											)}
											variant="ghost"
										>
											<CalendarIcon className="mr-2 h-3.5 w-3.5 opacity-60" />
											{dueDate ? format(dueDate, "PPP") : "Set due date"}
										</Button>
									</PopoverTrigger>
									<PopoverContent align="start" className="w-auto p-0">
										<CalendarWidget
											mode="single"
											onSelect={(d) => {
												setDueDate(d);
												setTimeout(handleSave, 100);
											}}
											selected={dueDate}
										/>
										{dueDate && (
											<div className="p-2 border-t">
												<Button
													className="text-destructive text-xs w-full"
													onClick={() => {
														setDueDate(undefined);
														setTimeout(handleSave, 100);
													}}
													size="sm"
													variant="ghost"
												>
													Clear date
												</Button>
											</div>
										)}
									</PopoverContent>
								</Popover>
							</PropertyRow>

							{/* Labels */}
							<PropertyRow alignTop label="Labels">
								<div className="space-y-2">
									{labels.length > 0 && (
										<div className="flex flex-wrap gap-1">
											{labels.map((label) => (
												<Badge
													className="text-[11px] px-2 py-0.5 gap-1 cursor-pointer hover:bg-destructive/10 hover:text-destructive transition-colors"
													key={label}
													onClick={() =>
														setLabels(labels.filter((l) => l !== label))
													}
													variant="secondary"
												>
													{label}
													<X className="w-2.5 h-2.5" />
												</Badge>
											))}
										</div>
									)}
									<div className="flex gap-2">
										<input
											className="flex-1 h-8 text-xs bg-muted/20 dark:bg-gray-800/20 border border-border/30 rounded-md px-3 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40 transition-colors"
											onChange={(e) => setLabelInput(e.target.value)}
											onKeyDown={(e) => {
												if (e.key === "Enter") {
													e.preventDefault();
													handleAddLabel();
												}
											}}
											placeholder="Add label..."
											value={labelInput}
										/>
										<Button
											className="h-8 text-xs px-3 border-border/40"
											onClick={handleAddLabel}
											size="sm"
											variant="outline"
										>
											Add
										</Button>
									</div>
								</div>
							</PropertyRow>
						</div>

						<Separator className="opacity-40" />

						{/* Metadata */}
						<div className="space-y-1.5 text-[11px] text-muted-foreground/50">
							<div className="flex items-center gap-2">
								<Calendar className="w-3 h-3" />
								<span>
									Created {format(new Date(issue.createdAt), "PPP 'at' p")}
								</span>
							</div>
							<div className="flex items-center gap-2">
								<Calendar className="w-3 h-3" />
								<span>
									Updated {format(new Date(issue.updatedAt), "PPP 'at' p")}
								</span>
							</div>
						</div>
					</div>
				</div>

				{/* ── Footer ── */}
				<div className="px-5 py-3 border-t border-border/40 dark:border-gray-800/80 bg-muted/10 flex items-center justify-between shrink-0">
					<span className="text-[11px] text-muted-foreground/50 font-mono">
						{formatIssueId(issue._id)}
					</span>
					<Button
						className="text-xs h-8 px-4"
						disabled={saving || !title.trim()}
						onClick={handleSave}
						size="sm"
					>
						{saving ? "Saving…" : "Save changes"}
					</Button>
				</div>
			</SheetContent>
		</Sheet>
	);
};

export default BoardIssueDrawer;
