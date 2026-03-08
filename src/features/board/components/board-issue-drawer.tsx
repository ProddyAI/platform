"use client";

import { useMutation, useQuery } from "convex/react";
import { format } from "date-fns";
import {
	Calendar,
	CalendarIcon,
	Check,
	ChevronRight,
	Minus,
	Plus,
	Send,
	Shield,
	Trash2,
	X,
} from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import MemberSelector from "@/components/member-selector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarWidget } from "@/components/ui/calendar";
import { Input } from "@/components/ui/input";
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

interface Status {
	_id: Id<"statuses">;
	name: string;
	color: string;
	order: number;
}

interface Member {
	_id: Id<"members">;
	user: {
		name?: string;
		email?: string;
		image?: string;
	};
}

interface SelectableMember {
	_id: Id<"members">;
	user: {
		name: string;
		image?: string;
		email?: string;
	};
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
	parentIssueId?: Id<"issues">;
}

interface IssueComment {
	_id: Id<"issueComments">;
	issueId: Id<"issues">;
	memberId: Id<"members">;
	workspaceId: Id<"workspaces">;
	message: string;
	createdAt: number;
	updatedAt?: number;
	member?: {
		userId: Id<"users">;
		workspaceId: Id<"workspaces">;
		role: "owner" | "admin" | "member";
		user: {
			name?: string;
			image?: string;
			email?: string;
		};
	};
}

interface BoardIssueDrawerProps {
	issue: Issue | null;
	open: boolean;
	onOpenChange: (open: boolean) => void;
	statuses: Status[];
	members: Member[];
	allIssues: Issue[];
	onDelete?: (issueId: Id<"issues">) => void;
	onClickIssue?: (issue: Issue) => void;
}

const PRIORITIES: IssuePriority[] = [
	"urgent",
	"high",
	"medium",
	"low",
	"no_priority",
];

interface DrawerHeaderProps {
	currentStatus?: Status;
	issueId: Id<"issues">;
	confirmDelete: boolean;
	onDelete: () => void;
	onClose: () => void;
	parentIssue?: Issue | null;
	onBackToParent?: () => void;
}

const DrawerHeader = ({
	currentStatus,
	issueId,
	confirmDelete,
	onDelete,
	onClose,
	parentIssue,
	onBackToParent,
}: DrawerHeaderProps) => (
	<div className="flex items-center justify-between px-5 py-3 border-b border-border/50 dark:border-gray-800/80 bg-muted/20 dark:bg-gray-900/50 shrink-0">
		<div className="flex items-center gap-1.5 text-xs text-muted-foreground overflow-hidden">
			{parentIssue && onBackToParent && (
				<Button
					className="h-6 w-6 p-0 flex-shrink-0 hover:bg-muted/60"
					onClick={onBackToParent}
					size="icon"
					title="Back to parent issue"
					variant="ghost"
				>
					<ChevronRight className="w-3.5 h-3.5 rotate-180" />
				</Button>
			)}
			{currentStatus && (
				<>
					<span
						className="w-2 h-2 rounded-full flex-shrink-0"
						style={{ backgroundColor: currentStatus.color }}
					/>
					<span className="truncate max-w-[120px]">{currentStatus.name}</span>
					<ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
				</>
			)}
			<span className="font-mono text-muted-foreground/70 flex-shrink-0">
				{formatIssueId(issueId)}
			</span>
			{parentIssue && (
				<>
					<ChevronRight className="w-3 h-3 flex-shrink-0 opacity-50" />
					<span className="truncate max-w-[150px] text-muted-foreground/90">
						{formatIssueId(parentIssue._id)}
					</span>
				</>
			)}
		</div>

		<div className="flex items-center gap-0.5 shrink-0">
			{confirmDelete && (
				<span className="text-[11px] text-destructive mr-2 font-medium">
					Click again to confirm
				</span>
			)}
			<Button
				className={cn(
					"h-8 w-8 rounded-lg transition-colors",
					confirmDelete
						? "bg-destructive/10 text-destructive hover:bg-destructive/20"
						: "hover:bg-destructive/10 hover:text-destructive text-muted-foreground"
				)}
				onClick={onDelete}
				size="icon"
				title="Delete issue"
				variant="ghost"
			>
				<Trash2 className="w-3.5 h-3.5" />
			</Button>
			<Button
				className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60"
				onClick={onClose}
				size="icon"
				title="Close"
				variant="ghost"
			>
				<X className="w-4 h-4" />
			</Button>
		</div>
	</div>
);

interface IssueContentProps {
	title: string;
	description: string;
	statusId: Id<"statuses"> | "";
	statuses: Status[];
	priority: IssuePriority;
	assignees: Id<"members">[];
	members: SelectableMember[];
	labels: string[];
	labelInput: string;
	dueDate?: Date;
	createdAt: number;
	updatedAt: number;
	onTitleChange: (value: string) => void;
	onDescriptionChange: (value: string) => void;
	onStatusChange: (value: string) => void;
	onPriorityChange: (value: string) => void;
	onAssigneesChange: (ids: Id<"members">[]) => void;
	onLabelsChange: (labels: string[]) => void;
	onLabelInputChange: (value: string) => void;
	onDueDateChange: (date: Date | undefined) => void;
	onAddLabel: () => void;
	onBlur: () => void;
}

const IssueContent = ({
	title,
	description,
	statusId,
	statuses,
	priority,
	assignees,
	members,
	labels,
	labelInput,
	dueDate,
	createdAt,
	updatedAt,
	onTitleChange,
	onDescriptionChange,
	onStatusChange,
	onPriorityChange,
	onAssigneesChange,
	onLabelsChange,
	onLabelInputChange,
	onAddLabel,
	onDueDateChange,
	onBlur,
}: IssueContentProps) => {
	const currentStatus = statuses.find((s) => s._id === statusId);

	return (
		<div className="px-6 py-5 space-y-5">
			<textarea
				className="w-full text-[22px] font-semibold bg-transparent border-none outline-none resize-none text-foreground placeholder:text-muted-foreground/30 leading-snug"
				onBlur={onBlur}
				onChange={(e) => onTitleChange(e.target.value)}
				placeholder="Issue title"
				rows={title.length > 55 ? 2 : 1}
				value={title}
			/>

			<Textarea
				className="min-h-[90px] text-sm bg-muted/20 dark:bg-gray-800/20 border-border/30 resize-none focus-visible:ring-1 focus-visible:ring-primary/30 placeholder:text-muted-foreground/40"
				onBlur={onBlur}
				onChange={(e) => onDescriptionChange(e.target.value)}
				placeholder="Add a description..."
				value={description}
			/>

			<Separator className="opacity-40" />

			<div className="space-y-3">
				<PropertyRow label="Status">
					<Select onValueChange={onStatusChange} value={statusId}>
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

				<PropertyRow label="Priority">
					<Select onValueChange={onPriorityChange} value={priority}>
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

				<PropertyRow alignTop label="Assignees">
					<MemberSelector
						members={members}
						onChange={onAssigneesChange}
						placeholder="Assign members"
						selectedMemberIds={assignees}
					/>
				</PropertyRow>

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
									onDueDateChange(d);
									setTimeout(onBlur, 100);
								}}
								selected={dueDate}
							/>
							{dueDate && (
								<div className="p-2 border-t">
									<Button
										className="text-destructive text-xs w-full"
										onClick={() => {
											onDueDateChange(undefined);
											setTimeout(onBlur, 100);
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

				<PropertyRow alignTop label="Labels">
					<div className="space-y-2">
						{labels.length > 0 && (
							<div className="flex flex-wrap gap-1">
								{labels.map((label) => (
									<button
										aria-label={`Remove ${label}`}
										className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full bg-secondary hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer border-none"
										key={label}
										onClick={() =>
											onLabelsChange(labels.filter((l) => l !== label))
										}
										type="button"
									>
										{label}
										<X className="w-2.5 h-2.5" />
									</button>
								))}
							</div>
						)}
						<div className="flex gap-2">
							<Input
								className="flex-1 h-8 text-xs bg-muted/20 dark:bg-gray-800/20 border border-border/30 rounded-md px-3 outline-none focus:border-primary/40 focus:ring-1 focus:ring-primary/20 placeholder:text-muted-foreground/40 transition-colors"
								onChange={(e) => onLabelInputChange(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										e.preventDefault();
										onAddLabel();
									}
								}}
								placeholder="Add label..."
								value={labelInput}
							/>
							<Button
								className="h-8 text-xs px-3 border-border/40"
								onClick={onAddLabel}
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

			<div className="space-y-1.5 text-[11px] text-muted-foreground/50">
				<div className="flex items-center gap-2">
					<Calendar className="w-3 h-3" />
					<span>Created {format(new Date(createdAt), "PPP 'at' p")}</span>
				</div>
				<div className="flex items-center gap-2">
					<Calendar className="w-3 h-3" />
					<span>Updated {format(new Date(updatedAt), "PPP 'at' p")}</span>
				</div>
			</div>
		</div>
	);
};

// Sub-Issues Section Component
interface SubIssuesSectionProps {
	parentIssue: Issue;
	members: SelectableMember[];
	statuses: Status[];
	onClickIssue: (issue: Issue) => void;
}

const SubIssuesSection = ({
	parentIssue,
	members,
	statuses,
	onClickIssue,
}: SubIssuesSectionProps) => {
	const subIssues = useQuery(
		api.board.getSubIssues,
		parentIssue ? { parentIssueId: parentIssue._id } : "skip"
	);
	const createSubIssue = useMutation(api.board.createSubIssue);
	const deleteSubIssue = useMutation(api.board.deleteSubIssue);
	const updateIssue = useMutation(api.board.updateIssue);

	const [isAdding, setIsAdding] = useState(false);
	const [newTitle, setNewTitle] = useState("");

	const handleAdd = async () => {
		if (!newTitle.trim()) return;
		try {
			await createSubIssue({
				parentIssueId: parentIssue._id,
				title: newTitle.trim(),
			});
			setNewTitle("");
			setIsAdding(false);
		} catch (error) {
			console.error("Failed to create sub-issue:", error);
			toast.error("Failed to create sub-issue");
		}
	};

	const handleDelete = async (subIssueId: Id<"issues">) => {
		try {
			await deleteSubIssue({ subIssueId });
		} catch (error) {
			console.error("Failed to delete sub-issue:", error);
			toast.error("Failed to delete sub-issue");
		}
	};

	const handleToggleCompletion = async (
		subIssueId: Id<"issues">,
		isCompleted: boolean
	) => {
		try {
			// Toggle status: if completed, move back to parent status; if not completed, move to a different status
			// We'll use the first non-parent status as the "completed" status, or last status if available
			const subIssue = subIssues?.find((s) => s._id === subIssueId);
			if (!subIssue) return;

			if (isCompleted) {
				// Mark as incomplete - move back to parent's status
				await updateIssue({
					issueId: subIssueId,
					statusId: parentIssue.statusId,
				});
			} else {
				// Mark as complete - move to a different status (preferably "Done" or last status)
				// Find a status that's different from parent's status
				const doneStatus =
					statuses.find(
						(s) =>
							s.name.toLowerCase().includes("done") ||
							s.name.toLowerCase().includes("complete")
					) || statuses.find((s) => s._id !== parentIssue.statusId);

				if (doneStatus) {
					await updateIssue({
						issueId: subIssueId,
						statusId: doneStatus._id,
					});
				}
			}
		} catch (error) {
			console.error("Failed to toggle sub-issue completion:", error);
			toast.error("Failed to update sub-issue");
		}
	};

	if (!subIssues) {
		return (
			<div className="text-sm text-muted-foreground">Loading sub-issues...</div>
		);
	}

	const completedCount = subIssues.filter(
		(s) => s.statusId !== parentIssue.statusId
	).length;
	const totalCount = subIssues.length;

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold">Sub-Issues</h3>
					{totalCount > 0 && (
						<span className="text-xs text-muted-foreground">
							{completedCount}/{totalCount} completed
						</span>
					)}
				</div>
				<Button
					className="h-7 px-2"
					onClick={() => setIsAdding(true)}
					size="sm"
					variant="ghost"
				>
					<Plus className="w-3.5 h-3.5 mr-1" />
					Add Sub-Issue
				</Button>
			</div>

			{totalCount > 0 && (
				<div className="w-full bg-muted rounded-full h-1.5">
					<div
						className="bg-primary h-1.5 rounded-full transition-all duration-300"
						style={{ width: `${(completedCount / totalCount) * 100}%` }}
					/>
				</div>
			)}

			<div className="space-y-2">
				{subIssues.map((subIssue) => {
					const isCompleted = subIssue.statusId !== parentIssue.statusId;
					const status = statuses.find((s) => s._id === subIssue.statusId);

					return (
						<div
							className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group cursor-pointer"
							key={subIssue._id}
							onClick={() => onClickIssue(subIssue)}
						>
							<div
								className="w-4 h-4 rounded-full border-2 flex-shrink-0 flex items-center justify-center"
								style={{
									borderColor: isCompleted
										? status?.color || "#00b341"
										: "#cbd5e1",
									backgroundColor: isCompleted
										? status?.color || "#00b341"
										: "transparent",
								}}
							>
								{isCompleted && (
									<Check className="w-3 h-3 text-white" strokeWidth={3} />
								)}
							</div>
							<span
								className={cn(
									"flex-1 text-sm truncate",
									isCompleted && "line-through text-muted-foreground"
								)}
							>
								{subIssue.title}
							</span>
							{subIssue.assignees && subIssue.assignees.length > 0 && (
								<div className="flex -space-x-1.5">
									{subIssue.assignees.slice(0, 2).map((assigneeId) => {
										const member = members.find((m) => m._id === assigneeId);
										const fallback =
											member?.user?.name?.charAt(0).toUpperCase() || "?";

										return (
											<Avatar
												className="h-4 w-4 border border-background"
												key={assigneeId}
											>
												<AvatarImage
													alt={member?.user?.name}
													src={member?.user?.image}
												/>
												<AvatarFallback className="text-[8px]">
													{fallback}
												</AvatarFallback>
											</Avatar>
										);
									})}
								</div>
							)}
							<div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
								<Button
									className={cn(
										"h-6 w-6",
										isCompleted
											? "text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
											: "text-muted-foreground hover:bg-muted/60"
									)}
									onClick={(e) => {
										e.stopPropagation();
										handleToggleCompletion(subIssue._id, isCompleted);
									}}
									size="icon"
									title={
										isCompleted ? "Mark as incomplete" : "Mark as complete"
									}
									variant="ghost"
								>
									<Check className="w-3.5 h-3.5" />
								</Button>
								<Button
									className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									onClick={(e) => {
										e.stopPropagation();
										handleDelete(subIssue._id);
									}}
									size="icon"
									title="Delete sub-issue"
									variant="ghost"
								>
									<X className="w-3 h-3" />
								</Button>
							</div>
						</div>
					);
				})}
			</div>

			{isAdding && (
				<div className="flex items-center gap-2 p-2 rounded-md border bg-card">
					<Input
						autoFocus
						className="flex-1 h-8 text-sm"
						onChange={(e) => setNewTitle(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleAdd();
							} else if (e.key === "Escape") {
								setIsAdding(false);
								setNewTitle("");
							}
						}}
						placeholder="Sub-issue title..."
						value={newTitle}
					/>
					<Button
						disabled={!newTitle.trim()}
						onClick={handleAdd}
						size="sm"
						variant="ghost"
					>
						<Plus className="w-3.5 h-3.5" />
					</Button>
					<Button
						onClick={() => {
							setIsAdding(false);
							setNewTitle("");
						}}
						size="sm"
						variant="ghost"
					>
						<X className="w-3.5 h-3.5" />
					</Button>
				</div>
			)}

			{!isAdding && totalCount === 0 && (
				<div className="text-center py-4 text-sm text-muted-foreground">
					No sub-issues yet. Click "Add Sub-Issue" to break down this task.
				</div>
			)}
		</div>
	);
};

// Blocking Section Component
interface BlockingSectionProps {
	issue: Issue;
	allIssues: Issue[];
	onClickIssue: (issue: Issue) => void;
}

const BlockingSection = ({
	issue,
	allIssues,
	onClickIssue,
}: BlockingSectionProps) => {
	const blockingIssues = useQuery(
		api.board.getBlockingIssues,
		issue ? { issueId: issue._id } : "skip"
	);
	const blockedByIssues = useQuery(
		api.board.getBlockedByIssues,
		issue ? { issueId: issue._id } : "skip"
	);
	const addBlocking = useMutation(api.board.addIssueBlockingRelationship);
	const removeBlocking = useMutation(api.board.removeIssueBlockingRelationship);

	const [selectedIssueId, setSelectedIssueId] = useState<string>("");

	const handleAddBlocking = async () => {
		if (!selectedIssueId) return;
		try {
			await addBlocking({
				channelId: issue.channelId,
				blockedIssueId: selectedIssueId as Id<"issues">,
				blockingIssueId: issue._id,
			});
			setSelectedIssueId("");
		} catch (error: any) {
			console.error("Failed to add blocking relationship:", error);
			toast.error(error.message || "Failed to add blocking relationship");
		}
	};

	const handleRemoveBlocking = async (blockedIssueId: Id<"issues">) => {
		try {
			await removeBlocking({
				channelId: issue.channelId,
				blockedIssueId,
				blockingIssueId: issue._id,
			});
		} catch (error: any) {
			console.error("Failed to remove blocking relationship:", error);
			toast.error(error.message || "Failed to remove blocking relationship");
		}
	};

	const handleRemoveBlockedBy = async (blockingIssueId: Id<"issues">) => {
		try {
			await removeBlocking({
				channelId: issue.channelId,
				blockedIssueId: issue._id,
				blockingIssueId,
			});
		} catch (error: any) {
			console.error("Failed to remove blocked by relationship:", error);
			toast.error(error.message || "Failed to remove blocked by relationship");
		}
	};

	// Filter out current issue and sub-issues from available issues
	const availableIssues = allIssues.filter(
		(i) => i._id !== issue._id && !i.parentIssueId
	);

	// Filter out issues already in blocking/blockedBy lists
	const blockingIds = new Set(blockingIssues?.map((i) => i._id) || []);
	const blockedByIds = new Set(blockedByIssues?.map((i) => i._id) || []);
	const usedIssueIds = new Set([...blockingIds, ...blockedByIds, issue._id]);

	const availableForBlocking = availableIssues.filter(
		(i) => !usedIssueIds.has(i._id)
	);

	return (
		<div className="space-y-4">
			{/* Blocking Section (Issues this issue blocks) */}
			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Shield className="w-4 h-4 text-orange-500" />
						<h3 className="text-sm font-semibold">Blocking</h3>
						{blockingIssues && blockingIssues.length > 0 && (
							<span className="text-xs text-muted-foreground">
								({blockingIssues.length} issue
								{blockingIssues.length !== 1 ? "s" : ""})
							</span>
						)}
					</div>
					{availableForBlocking.length > 0 && (
						<div className="flex items-center gap-2">
							<Select
								onValueChange={setSelectedIssueId}
								value={selectedIssueId}
							>
								<SelectTrigger className="h-7 w-40 text-xs">
									<SelectValue placeholder="Select issue..." />
								</SelectTrigger>
								<SelectContent>
									{availableForBlocking.map((i) => (
										<SelectItem key={i._id} value={i._id}>
											<span className="truncate">{i.title}</span>
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<Button
								className="h-7 w-7"
								disabled={!selectedIssueId}
								onClick={handleAddBlocking}
								size="icon"
								variant="ghost"
							>
								<Plus className="w-3.5 h-3.5" />
							</Button>
						</div>
					)}
				</div>

				{!blockingIssues ? (
					<div className="text-sm text-muted-foreground">Loading...</div>
				) : blockingIssues.length === 0 ? (
					<div className="text-sm text-muted-foreground py-2">
						No issues blocked by this issue
					</div>
				) : (
					<div className="space-y-1.5">
						{blockingIssues.map((blockedIssue) => (
							<div
								className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
								key={blockedIssue._id}
								onClick={() => onClickIssue(blockedIssue)}
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="w-1.5 h-1.5 rounded-full bg-orange-500 flex-shrink-0" />
									<span className="text-sm truncate">
										{formatIssueId(blockedIssue._id)} - {blockedIssue.title}
									</span>
								</div>
								<Button
									className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									onClick={(e) => {
										e.stopPropagation();
										handleRemoveBlocking(blockedIssue._id);
									}}
									size="icon"
									title="Remove blocking relationship"
									variant="ghost"
								>
									<Minus className="w-3 h-3" />
								</Button>
							</div>
						))}
					</div>
				)}
			</div>

			{/* Blocked By Section (Issues blocking this issue) */}
			<div>
				<div className="flex items-center justify-between mb-2">
					<div className="flex items-center gap-2">
						<Shield className="w-4 h-4 text-blue-500 rotate-180" />
						<h3 className="text-sm font-semibold">Blocked By</h3>
						{blockedByIssues && blockedByIssues.length > 0 && (
							<span className="text-xs text-muted-foreground">
								({blockedByIssues.length} issue
								{blockedByIssues.length !== 1 ? "s" : ""})
							</span>
						)}
					</div>
				</div>

				{!blockedByIssues ? (
					<div className="text-sm text-muted-foreground">Loading...</div>
				) : blockedByIssues.length === 0 ? (
					<div className="text-sm text-muted-foreground py-2">
						Not blocked by any issues
					</div>
				) : (
					<div className="space-y-1.5">
						{blockedByIssues.map((blockingIssue) => (
							<div
								className="flex items-center justify-between p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
								key={blockingIssue._id}
								onClick={() => onClickIssue(blockingIssue)}
							>
								<div className="flex items-center gap-2 flex-1 min-w-0">
									<div className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
									<span className="text-sm truncate">
										{formatIssueId(blockingIssue._id)} - {blockingIssue.title}
									</span>
								</div>
								<Button
									className="h-6 w-6 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
									onClick={(e) => {
										e.stopPropagation();
										handleRemoveBlockedBy(blockingIssue._id);
									}}
									size="icon"
									title="Remove blocked by relationship"
									variant="ghost"
								>
									<Minus className="w-3 h-3" />
								</Button>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	);
};

// Discussion Section Component
interface DiscussionSectionProps {
	issue: Issue;
	members: SelectableMember[];
}

const DiscussionSection = ({ issue, members }: DiscussionSectionProps) => {
	const comments = useQuery(
		api.board.getIssueComments,
		issue ? { issueId: issue._id } : "skip"
	);
	const createComment = useMutation(api.board.createIssueComment);
	const deleteComment = useMutation(api.board.deleteIssueComment);

	const [message, setMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	const handleSend = async () => {
		if (!message.trim()) return;
		try {
			await createComment({
				issueId: issue._id,
				message: message.trim(),
			});
			setMessage("");
		} catch (error) {
			console.error("Failed to send comment:", error);
			toast.error("Failed to send comment");
		}
	};

	const handleDelete = async (commentId: Id<"issueComments">) => {
		try {
			await deleteComment({ commentId });
		} catch (error) {
			console.error("Failed to delete comment:", error);
			toast.error("Failed to delete comment");
		}
	};

	if (!comments) {
		return (
			<div className="text-sm text-muted-foreground">Loading discussion...</div>
		);
	}

	return (
		<div className="space-y-3">
			<h3 className="text-sm font-semibold">Discussion</h3>

			<div className="space-y-3 max-h-[300px] overflow-y-auto pr-2">
				{comments.length === 0 ? (
					<div className="text-center py-6 text-sm text-muted-foreground">
						No comments yet. Start the discussion!
					</div>
				) : (
					comments.map((comment) => {
						const member = comment.member;
						const fallback = member?.user?.name?.charAt(0).toUpperCase() || "?";

						return (
							<div className="flex gap-2 group" key={comment._id}>
								<Avatar className="h-7 w-7 flex-shrink-0">
									<AvatarImage
										alt={member?.user?.name}
										src={member?.user?.image}
									/>
									<AvatarFallback className="text-[10px]">
										{fallback}
									</AvatarFallback>
								</Avatar>
								<div className="flex-1 min-w-0">
									<div className="flex items-center gap-2">
										<span className="text-xs font-medium">
											{member?.user?.name || "Unknown"}
										</span>
										<span className="text-[10px] text-muted-foreground">
											{format(
												new Date(comment.createdAt),
												"MMM d, yyyy 'at' p"
											)}
										</span>
									</div>
									<p className="text-sm text-foreground mt-0.5 break-words">
										{comment.message}
									</p>
								</div>
								<Button
									className="opacity-0 group-hover:opacity-100 transition-opacity h-6 w-6"
									onClick={() => handleDelete(comment._id)}
									size="icon"
									variant="ghost"
								>
									<X className="w-3 h-3" />
								</Button>
							</div>
						);
					})
				)}
				<div ref={messagesEndRef} />
			</div>

			<div className="flex gap-2 pt-2 border-t">
				<Input
					className="flex-1 h-9 text-sm"
					onChange={(e) => setMessage(e.target.value)}
					onKeyDown={(e) => {
						if (e.key === "Enter" && !e.shiftKey) {
							e.preventDefault();
							handleSend();
						}
					}}
					placeholder="Write a comment..."
					value={message}
				/>
				<Button
					disabled={!message.trim()}
					onClick={handleSend}
					size="sm"
					variant="default"
				>
					<Send className="w-3.5 h-3.5" />
				</Button>
			</div>
		</div>
	);
};

interface DrawerFooterProps {
	issueId: Id<"issues">;
	saving: boolean;
	title: string;
	onSave: () => void;
}

const DrawerFooter = ({
	issueId,
	saving,
	title,
	onSave,
}: DrawerFooterProps) => (
	<div className="px-5 py-3 border-t border-border/40 dark:border-gray-800/80 bg-muted/10 flex items-center justify-between shrink-0">
		<span className="text-[11px] text-muted-foreground/50 font-mono">
			{formatIssueId(issueId)}
		</span>
		<Button
			className="text-xs h-8 px-4"
			disabled={saving || !title.trim()}
			onClick={onSave}
			size="sm"
		>
			{saving ? "Saving…" : "Save changes"}
		</Button>
	</div>
);

const BoardIssueDrawer: React.FC<BoardIssueDrawerProps> = ({
	issue,
	open,
	onOpenChange,
	statuses,
	members,
	allIssues,
	onDelete,
	onClickIssue,
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
	const [dueDate, setDueDate] = useState<Date>();
	const [saving, setSaving] = useState(false);
	const [confirmDelete, setConfirmDelete] = useState(false);

	// Fetch parent issue if this is a sub-issue
	const parentIssue = useQuery(
		api.board._getIssueDetails,
		issue?.parentIssueId ? { issueId: issue.parentIssueId } : "skip"
	);

	const normalizedMembers: SelectableMember[] = members.map((member) => ({
		...member,
		user: {
			...member.user,
			name: member.user.name || "Unknown",
		},
	}));

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
		} catch (error) {
			console.error("Error saving issue:", error);
			toast.error("Failed to save issue changes");
		} finally {
			setSaving(false);
		}
	};

	const handleStatusChange = async (newStatusId: string) => {
		const previousStatusId = statusId;
		setStatusId(newStatusId as Id<"statuses">);
		if (!issue) return;
		try {
			await updateIssue({
				issueId: issue._id,
				statusId: newStatusId as Id<"statuses">,
			});
		} catch (error) {
			console.error("Error updating status:", error);
			toast.error("Failed to update status");
			setStatusId(previousStatusId);
		}
	};

	const handlePriorityChange = async (val: string) => {
		const newPriority = val as IssuePriority;
		const previousPriority = priority;
		setPriority(newPriority);
		try {
			await updateIssue({ issueId: issue._id, priority: newPriority });
		} catch (error) {
			console.error("Error updating priority:", error);
			toast.error("Failed to update priority");
			setPriority(previousPriority);
		}
	};

	const handleDelete = async () => {
		if (!confirmDelete) {
			setConfirmDelete(true);
			setTimeout(() => setConfirmDelete(false), 3000);
			return;
		}
		try {
			await deleteIssue({ issueId: issue._id });
			onOpenChange(false);
			onDelete?.(issue._id);
		} catch (error) {
			console.error("Error deleting issue:", error);
			toast.error("Failed to delete issue");
			setConfirmDelete(false);
		}
	};

	const handleAddLabel = () => {
		const trimmed = labelInput.trim();
		if (trimmed && !labels.includes(trimmed)) {
			setLabels([...labels, trimmed]);
			setLabelInput("");
		}
	};

	const handleSubIssueClick = (subIssue: Issue) => {
		onClickIssue?.(subIssue);
	};

	const handleBackToParent = () => {
		if (parentIssue) {
			// Navigate to parent issue by calling onClickIssue with parent
			onClickIssue?.({
				_id: parentIssue._id,
				channelId: parentIssue.channelId,
				statusId: parentIssue.statusId,
				title: parentIssue.title,
				description: parentIssue.description,
				priority: parentIssue.priority,
				assignees: parentIssue.assignees,
				labels: parentIssue.labels,
				dueDate: parentIssue.dueDate,
				order: parentIssue.order,
				createdAt: parentIssue.createdAt,
				updatedAt: parentIssue.updatedAt,
			});
		}
	};

	return (
		<Sheet onOpenChange={onOpenChange} open={open}>
			<SheetContent
				className="w-full sm:max-w-[580px] p-0 flex flex-col gap-0 border-l border-border/60 dark:border-gray-800 overflow-hidden"
				showCloseButton={false}
				side="right"
			>
				<DrawerHeader
					confirmDelete={confirmDelete}
					currentStatus={currentStatus}
					issueId={issue._id}
					onBackToParent={parentIssue ? handleBackToParent : undefined}
					onClose={() => onOpenChange(false)}
					onDelete={handleDelete}
					parentIssue={
						parentIssue
							? {
									_id: parentIssue._id,
									channelId: parentIssue.channelId,
									statusId: parentIssue.statusId,
									title: parentIssue.title,
									order: parentIssue.order,
									createdAt: parentIssue.createdAt,
									updatedAt: parentIssue.updatedAt,
								}
							: null
					}
				/>

				<div className="flex-1 overflow-y-auto">
					<IssueContent
						assignees={assignees}
						createdAt={issue.createdAt}
						description={description}
						dueDate={dueDate}
						labelInput={labelInput}
						labels={labels}
						members={normalizedMembers}
						onAddLabel={handleAddLabel}
						onAssigneesChange={setAssignees}
						onBlur={handleSave}
						onDescriptionChange={setDescription}
						onDueDateChange={setDueDate}
						onLabelInputChange={setLabelInput}
						onLabelsChange={setLabels}
						onPriorityChange={handlePriorityChange}
						onStatusChange={handleStatusChange}
						onTitleChange={setTitle}
						priority={priority}
						statuses={statuses}
						statusId={statusId}
						title={title}
						updatedAt={issue.updatedAt}
					/>

					<Separator className="opacity-40" />

					{/* Sub-Issues Section - only for parent issues */}
					{!issue.parentIssueId && (
						<div className="px-6 py-5">
							<SubIssuesSection
								members={normalizedMembers}
								onClickIssue={handleSubIssueClick}
								parentIssue={issue}
								statuses={statuses}
							/>
						</div>
					)}

					<Separator className="opacity-40" />

					{/* Blocking Section */}
					<div className="px-6 py-5">
						<BlockingSection
							allIssues={allIssues}
							issue={issue}
							onClickIssue={onClickIssue!}
						/>
					</div>

					<Separator className="opacity-40" />

					{/* Discussion Section */}
					<div className="px-6 py-5">
						<DiscussionSection issue={issue} members={normalizedMembers} />
					</div>
				</div>

				<DrawerFooter
					issueId={issue._id}
					onSave={handleSave}
					saving={saving}
					title={title}
				/>
			</SheetContent>
		</Sheet>
	);
};

export default BoardIssueDrawer;
