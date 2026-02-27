import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import React from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import LabelInput from "@/components/label-input";
import MemberSelector from "@/components/member-selector";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
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
import { cn } from "@/lib/utils";

// BoardAddListModal
interface BoardAddListModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	setTitle: (v: string) => void;
	onAdd: () => void;
}

export const BoardAddListModal: React.FC<BoardAddListModalProps> = ({
	open,
	onOpenChange,
	title,
	setTitle,
	onAdd,
}) => (
	<Dialog onOpenChange={onOpenChange} open={open}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add List</DialogTitle>
				<DialogDescription>Enter a title for the new list.</DialogDescription>
			</DialogHeader>
			<Input
				autoFocus
				onChange={(e) => setTitle(e.target.value)}
				placeholder="List title"
				value={title}
			/>
			<DialogFooter>
				<Button onClick={onAdd}>Add</Button>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);

// BoardEditListModal
interface BoardEditListModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	setTitle: (v: string) => void;
	onSave: () => void;
}

export const BoardEditListModal: React.FC<BoardEditListModalProps> = ({
	open,
	onOpenChange,
	title,
	setTitle,
	onSave,
}) => (
	<Dialog onOpenChange={onOpenChange} open={open}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit List</DialogTitle>
			</DialogHeader>
			<Input
				autoFocus
				onChange={(e) => setTitle(e.target.value)}
				placeholder="List title"
				value={title}
			/>
			<DialogFooter>
				<Button onClick={onSave}>Save</Button>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);

// BoardDeleteListModal
interface BoardDeleteListModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onDelete: () => void;
}

export const BoardDeleteListModal: React.FC<BoardDeleteListModalProps> = ({
	open,
	onOpenChange,
	onDelete,
}) => (
	<Dialog onOpenChange={onOpenChange} open={open}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Delete List</DialogTitle>
				<DialogDescription>
					This will delete the list and all its cards. Are you sure?
				</DialogDescription>
			</DialogHeader>
			<DialogFooter>
				<Button onClick={onDelete} variant="destructive">
					Delete
				</Button>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);

// BoardAddCardModal
interface BoardAddCardModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	setTitle: (v: string) => void;
	description: string;
	setDescription: (v: string) => void;
	labels: string;
	setLabels: (v: string) => void;
	priority: "" | "lowest" | "low" | "medium" | "high" | "highest";
	setPriority: (
		v: "" | "lowest" | "low" | "medium" | "high" | "highest"
	) => void;
	dueDate: Date | undefined;
	setDueDate: (v: Date | undefined) => void;
	assignees: Id<"members">[];
	setAssignees: (v: Id<"members">[]) => void;
	members: any[];
	labelSuggestions: string[];
	onAdd: () => void;
}

export const BoardAddCardModal: React.FC<BoardAddCardModalProps> = ({
	open,
	onOpenChange,
	title,
	setTitle,
	description,
	setDescription,
	labels,
	setLabels,
	priority,
	setPriority,
	dueDate,
	setDueDate,
	assignees,
	setAssignees,
	members,
	labelSuggestions,
	onAdd,
}) => (
	<Dialog onOpenChange={onOpenChange} open={open}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add Card</DialogTitle>
				<DialogDescription>Enter details for the new card.</DialogDescription>
			</DialogHeader>
			<Input
				autoFocus
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Card title"
				value={title}
			/>
			<Input
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Description (optional)"
				value={description}
			/>
			<LabelInput
				onChange={setLabels}
				placeholder="Labels (comma separated)"
				suggestions={labelSuggestions}
				value={labels}
			/>
			<MemberSelector
				members={members}
				onChange={setAssignees}
				placeholder="Assign members"
				selectedMemberIds={assignees}
			/>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<Select
						onValueChange={(v) =>
							setPriority(
								v as "" | "lowest" | "low" | "medium" | "high" | "highest"
							)
						}
						value={priority}
					>
						<SelectTrigger className="w-full">
							<SelectValue placeholder="Priority" />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value="lowest">Lowest</SelectItem>
							<SelectItem value="low">Low</SelectItem>
							<SelectItem value="medium">Medium</SelectItem>
							<SelectItem value="high">High</SelectItem>
							<SelectItem value="highest">Highest</SelectItem>
						</SelectContent>
					</Select>
				</div>

				<div>
					<Popover>
						<PopoverTrigger asChild>
							<Button
								className={cn(
									"w-full justify-start text-left font-normal",
									!dueDate && "text-muted-foreground"
								)}
								variant="outline"
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{dueDate ? format(dueDate, "PPP") : <span>Due Date</span>}
							</Button>
						</PopoverTrigger>
						<PopoverContent align="start" className="w-auto p-0">
							<Calendar
								initialFocus
								mode="single"
								onSelect={setDueDate}
								selected={dueDate}
							/>
							{dueDate && (
								<div className="p-2 border-t">
									<Button
										className="text-destructive hover:text-destructive/90"
										onClick={() => setDueDate(undefined)}
										size="sm"
										variant="ghost"
									>
										Clear Date
									</Button>
								</div>
							)}
						</PopoverContent>
					</Popover>
				</div>
			</div>

			<DialogFooter>
				<Button onClick={onAdd}>Add</Button>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);

// BoardEditCardModal
interface BoardEditCardModalProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	cardId: Id<"cards">;
	channelId: Id<"channels">;
	title: string;
	setTitle: (v: string) => void;
	description: string;
	setDescription: (v: string) => void;
	labels: string;
	setLabels: (v: string) => void;
	priority: "" | "lowest" | "low" | "medium" | "high" | "highest";
	setPriority: (
		v: "" | "lowest" | "low" | "medium" | "high" | "highest"
	) => void;
	dueDate: Date | undefined;
	setDueDate: (v: Date | undefined) => void;
	assignees: Id<"members">[];
	setAssignees: (v: Id<"members">[]) => void;
	members: any[];
	labelSuggestions: string[];
	watchers?: Id<"members">[];
	currentMemberId?: Id<"members">;
	estimate?: number;
	timeSpent?: number;
	onSave: () => void;
}

const BoardSubtaskList = React.lazy(() =>
	import("./board-subtask-list").then((m) => ({
		default: m.BoardSubtaskList,
	}))
);
const BoardCardComments = React.lazy(() =>
	import("./board-card-comments").then((m) => ({
		default: m.BoardCardComments,
	}))
);
const BoardCardTimeTracking = React.lazy(() =>
	import("./board-card-time-tracking").then((m) => ({
		default: m.BoardCardTimeTracking,
	}))
);
const BoardCardActivity = React.lazy(() =>
	import("./board-card-activity").then((m) => ({
		default: m.BoardCardActivity,
	}))
);
const BoardCardWatchers = React.lazy(() =>
	import("./board-card-watchers").then((m) => ({
		default: m.BoardCardWatchers,
	}))
);
const BoardCardBlockingRelationships = React.lazy(() =>
	import("./board-card-blocking").then((m) => ({
		default: m.BoardCardBlockingRelationships,
	}))
);

export const BoardEditCardModal: React.FC<BoardEditCardModalProps> = ({
	open,
	onOpenChange,
	cardId,
	channelId,
	title,
	setTitle,
	description,
	setDescription,
	labels,
	setLabels,
	priority,
	setPriority,
	dueDate,
	setDueDate,
	assignees,
	setAssignees,
	members,
	labelSuggestions,
	watchers = [],
	currentMemberId,
	estimate,
	timeSpent,
	onSave,
}) => {
	const [activeTab, setActiveTab] = React.useState<"details" | "activity">(
		"details"
	);

	return (
		<Dialog onOpenChange={onOpenChange} open={open}>
			<DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
				<DialogHeader>
					<DialogTitle>Edit Card</DialogTitle>
					<div className="flex gap-1 mt-2">
						<Button
							onClick={() => setActiveTab("details")}
							size="sm"
							variant={activeTab === "details" ? "secondary" : "ghost"}
						>
							Details
						</Button>
						<Button
							onClick={() => setActiveTab("activity")}
							size="sm"
							variant={activeTab === "activity" ? "secondary" : "ghost"}
						>
							Activity
						</Button>
					</div>
				</DialogHeader>

				<div className="flex-1 overflow-y-auto space-y-4 px-1">
					{activeTab === "details" ? (
						<>
							<Input
								autoFocus
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Card title"
								value={title}
							/>
							<Input
								onChange={(e) => setDescription(e.target.value)}
								placeholder="Description (optional)"
								value={description}
							/>
							<LabelInput
								onChange={setLabels}
								placeholder="Labels (comma separated)"
								suggestions={labelSuggestions}
								value={labels}
							/>

							<div className="flex items-center gap-2">
								<MemberSelector
									members={members}
									onChange={setAssignees}
									placeholder="Assign members"
									selectedMemberIds={assignees}
								/>
								<React.Suspense fallback={<div>Loading...</div>}>
									<BoardCardWatchers
										cardId={cardId}
										currentMemberId={currentMemberId}
										members={members}
										watchers={watchers}
									/>
								</React.Suspense>
							</div>

							<div className="grid grid-cols-2 gap-4">
								<div>
									<Select
										onValueChange={(v) =>
											setPriority(
												v as
													| ""
													| "lowest"
													| "low"
													| "medium"
													| "high"
													| "highest"
											)
										}
										value={priority}
									>
										<SelectTrigger className="w-full">
											<SelectValue placeholder="Priority" />
										</SelectTrigger>
										<SelectContent>
											<SelectItem value="lowest">Lowest</SelectItem>
											<SelectItem value="low">Low</SelectItem>
											<SelectItem value="medium">Medium</SelectItem>
											<SelectItem value="high">High</SelectItem>
											<SelectItem value="highest">Highest</SelectItem>
										</SelectContent>
									</Select>
								</div>

								<div>
									<Popover>
										<PopoverTrigger asChild>
											<Button
												className={cn(
													"w-full justify-start text-left font-normal",
													!dueDate && "text-muted-foreground"
												)}
												variant="outline"
											>
												<CalendarIcon className="mr-2 h-4 w-4" />
												{dueDate ? (
													format(dueDate, "PPP")
												) : (
													<span>Due Date</span>
												)}
											</Button>
										</PopoverTrigger>
										<PopoverContent align="start" className="w-auto p-0">
											<Calendar
												initialFocus
												mode="single"
												onSelect={setDueDate}
												selected={dueDate}
											/>
											{dueDate && (
												<div className="p-2 border-t">
													<Button
														className="text-destructive hover:text-destructive/90"
														onClick={() => setDueDate(undefined)}
														size="sm"
														variant="ghost"
													>
														Clear Date
													</Button>
												</div>
											)}
										</PopoverContent>
									</Popover>
								</div>
							</div>

							{/* Blocking Relationships */}
							<React.Suspense fallback={<div>Loading...</div>}>
								<BoardCardBlockingRelationships
									cardId={cardId}
									channelId={channelId}
								/>
							</React.Suspense>

							{/* Time Tracking */}
							<React.Suspense fallback={<div>Loading...</div>}>
								<BoardCardTimeTracking
									cardId={cardId}
									estimate={estimate}
									timeSpent={timeSpent}
								/>
							</React.Suspense>

							{/* Subtasks */}
							<div className="border-t pt-4">
								<React.Suspense fallback={<div>Loading...</div>}>
									<BoardSubtaskList members={members} parentCardId={cardId} />
								</React.Suspense>
							</div>

							{/* Comments */}
							<div className="border-t pt-4">
								<React.Suspense fallback={<div>Loading...</div>}>
									<BoardCardComments cardId={cardId} />
								</React.Suspense>
							</div>
						</>
					) : (
						<React.Suspense fallback={<div>Loading activity...</div>}>
							<BoardCardActivity cardId={cardId} />
						</React.Suspense>
					)}
				</div>

				<DialogFooter>
					<Button onClick={onSave}>Save</Button>
					<DialogClose asChild>
						<Button variant="outline">Cancel</Button>
					</DialogClose>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
};
