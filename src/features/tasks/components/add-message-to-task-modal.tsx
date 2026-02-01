"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
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

import { useCreateTaskFromMessage } from "../api/use-create-task-from-message";
import { TaskCategorySelector } from "./task-category-selector";

interface AddMessageToTaskModalProps {
	isOpen: boolean;
	onClose: () => void;
	messageId: Id<"messages">;
	workspaceId: Id<"workspaces">;
	messageContent: string;
}

export const AddMessageToTaskModal = ({
	isOpen,
	onClose,
	messageId,
	workspaceId,
	messageContent,
}: AddMessageToTaskModalProps) => {
	// Use the entire message content as the task title
	const extractTitle = (content: string): string => {
		return content || "New Task";
	};

	// Form state
	const [title, setTitle] = useState(() => {
		if (!messageContent) {
			return "New Task";
		}
		const extractedTitle = extractTitle(messageContent);
		return extractedTitle || "New Task";
	});
	const [dueDate, setDueDate] = useState<Date | undefined>(undefined);
	const [priority, setPriority] = useState<
		"low" | "medium" | "high" | undefined
	>(undefined);
	const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);

	// Loading state
	const [isSubmitting, setIsSubmitting] = useState(false);

	// API hook
	const createTaskFromMessage = useCreateTaskFromMessage();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim()) return;

		setIsSubmitting(true);
		try {
			await createTaskFromMessage({
				messageId,
				workspaceId,
				title,
				dueDate: dueDate ? dueDate.getTime() : undefined,
				priority,
				categoryId: categoryId || undefined,
			});

			toast.success("Message added to tasks");
			handleClose();
		} catch (error) {
			console.error("Failed to create task from message:", error);
			toast.error("Failed to add message to tasks");
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleClose = () => {
		setTitle(messageContent ? extractTitle(messageContent) : "New Task");
		setDueDate(undefined);
		setPriority(undefined);
		setCategoryId(null);
		setIsSubmitting(false);
		onClose();
	};

	return (
		<Dialog onOpenChange={handleClose} open={isOpen}>
			<DialogContent className="sm:max-w-[550px]">
				<form onSubmit={handleSubmit}>
					<DialogHeader>
						<DialogTitle>Add Message to Tasks</DialogTitle>
						<DialogDescription>
							Add this message as a task. You can edit the title and set
							additional details below.
						</DialogDescription>
					</DialogHeader>

					{/* Message preview */}
					<div className="mt-4 rounded-md border bg-gray-50 p-3">
						<p className="text-xs font-medium text-gray-500 mb-1">
							Message content:
						</p>
						{messageContent ? (
							<p className="text-sm text-gray-700 font-medium">
								{messageContent}
							</p>
						) : (
							<p className="text-sm text-gray-500 italic">
								No message content available. Please enter a title manually.
							</p>
						)}
					</div>

					<div className="mt-4 space-y-4">
						<div className="space-y-2">
							<label className="text-sm font-medium" htmlFor="title">
								Task Title
							</label>
							<Input
								className="w-full"
								id="title"
								onChange={(e) => setTitle(e.target.value)}
								placeholder="Enter task title"
								required
								value={title}
							/>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Due Date</label>
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
											<span>Pick a date</span>
										)}
									</Button>
								</PopoverTrigger>
								<PopoverContent className="w-auto p-0">
									<Calendar
										initialFocus
										mode="single"
										onSelect={setDueDate}
										selected={dueDate}
									/>
								</PopoverContent>
							</Popover>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Priority</label>
							<Select
								onValueChange={(value: any) => setPriority(value)}
								value={priority}
							>
								<SelectTrigger>
									<SelectValue placeholder="Select priority" />
								</SelectTrigger>
								<SelectContent>
									<SelectItem value="low">Low</SelectItem>
									<SelectItem value="medium">Medium</SelectItem>
									<SelectItem value="high">High</SelectItem>
								</SelectContent>
							</Select>
						</div>

						<div className="space-y-2">
							<label className="text-sm font-medium">Category</label>
							<TaskCategorySelector
								onChange={setCategoryId}
								value={categoryId}
								workspaceId={workspaceId}
							/>
						</div>
					</div>

					<DialogFooter className="mt-6">
						<div className="flex gap-2">
							<Button
								disabled={isSubmitting}
								onClick={handleClose}
								type="button"
								variant="outline"
							>
								Cancel
							</Button>
							<Button disabled={isSubmitting} type="submit">
								{isSubmitting ? "Adding..." : "Add Task"}
							</Button>
						</div>
					</DialogFooter>
				</form>
			</DialogContent>
		</Dialog>
	);
};
