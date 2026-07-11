"use client";

import { format, parse } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface TaskCreationModalProps {
	isOpen: boolean;
	onClose: () => void;
	taskTitle: string;
	taskContent: string;
	taskDueDate: string;
	onTaskTitleChange: (value: string) => void;
	onTaskContentChange: (value: string) => void;
	onTaskDueDateChange: (value: string) => void;
	onCreateTask: () => void | Promise<void>;
}

export const TaskCreationModal = ({
	isOpen,
	onClose,
	taskTitle,
	taskContent,
	taskDueDate,
	onTaskTitleChange,
	onTaskContentChange,
	onTaskDueDateChange,
	onCreateTask,
}: TaskCreationModalProps) => {
	const [isSubmitting, setIsSubmitting] = useState(false);
	const selectedDueDate = taskDueDate
		? parse(taskDueDate, "yyyy-MM-dd", new Date())
		: undefined;

	const handleCreate = async () => {
		setIsSubmitting(true);
		try {
			await onCreateTask();
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CalendarIcon className="size-5" />
						Create Task from Message
					</DialogTitle>
				</DialogHeader>
				<div className="space-y-4">
					<div>
						<Label htmlFor="task-title">Task Title</Label>
						<Input
							id="task-title"
							onChange={(e) => onTaskTitleChange(e.target.value)}
							placeholder="Enter task title..."
							value={taskTitle}
						/>
					</div>
					<div>
						<Label htmlFor="task-content">Task Description</Label>
						<Textarea
							id="task-content"
							onChange={(e) => onTaskContentChange(e.target.value)}
							placeholder="Task description..."
							rows={3}
							value={taskContent}
						/>
					</div>
					<div>
						<Label htmlFor="task-due-date">Due Date (Optional)</Label>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									className={cn(
										"w-full justify-start text-left font-normal",
										!selectedDueDate && "text-muted-foreground"
									)}
									id="task-due-date"
									type="button"
									variant="outline"
								>
									<CalendarIcon className="mr-2 size-4" />
									{selectedDueDate ? (
										format(selectedDueDate, "PPP")
									) : (
										<span>Pick a date</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-auto p-0">
								<Calendar
									onSelect={(date) =>
										onTaskDueDateChange(format(date, "yyyy-MM-dd"))
									}
									selected={selectedDueDate}
								/>
								{selectedDueDate && (
									<div className="flex justify-end border-t p-2">
										<Button
											onClick={() => onTaskDueDateChange("")}
											size="sm"
											type="button"
											variant="ghost"
										>
											Clear date
										</Button>
									</div>
								)}
							</PopoverContent>
						</Popover>
					</div>
					<div className="flex justify-end gap-2">
						<Button disabled={isSubmitting} onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button
							disabled={!taskTitle.trim() || isSubmitting}
							loading={isSubmitting}
							onClick={handleCreate}
						>
							Create Task
						</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
