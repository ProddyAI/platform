import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import type React from "react";
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
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add List</DialogTitle>
				<DialogDescription>Enter a title for the new list.</DialogDescription>
			</DialogHeader>
			<Input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="List title"
				autoFocus
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
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit List</DialogTitle>
			</DialogHeader>
			<Input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="List title"
				autoFocus
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
	<Dialog open={open} onOpenChange={onOpenChange}>
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
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Add Card</DialogTitle>
				<DialogDescription>Enter details for the new card.</DialogDescription>
			</DialogHeader>
			<Input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Card title"
				autoFocus
			/>
			<Input
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Description (optional)"
			/>
			<LabelInput
				value={labels}
				onChange={setLabels}
				suggestions={labelSuggestions}
				placeholder="Labels (comma separated)"
			/>
			<MemberSelector
				members={members}
				selectedMemberIds={assignees}
				onChange={setAssignees}
				placeholder="Assign members"
			/>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<Select
						value={priority}
						onValueChange={(v) =>
							setPriority(
								v as "" | "lowest" | "low" | "medium" | "high" | "highest"
							)
						}
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
								variant="outline"
								className={cn(
									"w-full justify-start text-left font-normal",
									!dueDate && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{dueDate ? format(dueDate, "PPP") : <span>Due Date</span>}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={dueDate}
								onSelect={setDueDate}
								initialFocus
							/>
							{dueDate && (
								<div className="p-2 border-t">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDueDate(undefined)}
										className="text-destructive hover:text-destructive/90"
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
	onSave: () => void;
}

export const BoardEditCardModal: React.FC<BoardEditCardModalProps> = ({
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
	onSave,
}) => (
	<Dialog open={open} onOpenChange={onOpenChange}>
		<DialogContent>
			<DialogHeader>
				<DialogTitle>Edit Card</DialogTitle>
			</DialogHeader>
			<Input
				value={title}
				onChange={(e) => setTitle(e.target.value)}
				placeholder="Card title"
				autoFocus
			/>
			<Input
				value={description}
				onChange={(e) => setDescription(e.target.value)}
				placeholder="Description (optional)"
			/>
			<LabelInput
				value={labels}
				onChange={setLabels}
				suggestions={labelSuggestions}
				placeholder="Labels (comma separated)"
			/>
			<MemberSelector
				members={members}
				selectedMemberIds={assignees}
				onChange={setAssignees}
				placeholder="Assign members"
			/>

			<div className="grid grid-cols-2 gap-4">
				<div>
					<Select
						value={priority}
						onValueChange={(v) =>
							setPriority(
								v as "" | "lowest" | "low" | "medium" | "high" | "highest"
							)
						}
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
								variant="outline"
								className={cn(
									"w-full justify-start text-left font-normal",
									!dueDate && "text-muted-foreground"
								)}
							>
								<CalendarIcon className="mr-2 h-4 w-4" />
								{dueDate ? format(dueDate, "PPP") : <span>Due Date</span>}
							</Button>
						</PopoverTrigger>
						<PopoverContent className="w-auto p-0" align="start">
							<Calendar
								mode="single"
								selected={dueDate}
								onSelect={setDueDate}
								initialFocus
							/>
							{dueDate && (
								<div className="p-2 border-t">
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDueDate(undefined)}
										className="text-destructive hover:text-destructive/90"
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
				<Button onClick={onSave}>Save</Button>
				<DialogClose asChild>
					<Button variant="outline">Cancel</Button>
				</DialogClose>
			</DialogFooter>
		</DialogContent>
	</Dialog>
);
