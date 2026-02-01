"use client";

import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface TaskCreationModalProps {
	isOpen: boolean;
	onClose: () => void;
	taskTitle: string;
	taskContent: string;
	taskDueDate: string;
	onTaskTitleChange: (value: string) => void;
	onTaskContentChange: (value: string) => void;
	onTaskDueDateChange: (value: string) => void;
	onCreateTask: () => void;
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
	return (
		<Dialog onOpenChange={onClose} open={isOpen}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<CalendarIcon className="h-5 w-5" />
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
						<Input
							id="task-due-date"
							onChange={(e) => onTaskDueDateChange(e.target.value)}
							type="date"
							value={taskDueDate}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button onClick={onClose} variant="outline">
							Cancel
						</Button>
						<Button onClick={onCreateTask}>Create Task</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
