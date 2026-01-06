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
		<Dialog open={isOpen} onOpenChange={onClose}>
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
							value={taskTitle}
							onChange={(e) => onTaskTitleChange(e.target.value)}
							placeholder="Enter task title..."
						/>
					</div>
					<div>
						<Label htmlFor="task-content">Task Description</Label>
						<Textarea
							id="task-content"
							value={taskContent}
							onChange={(e) => onTaskContentChange(e.target.value)}
							placeholder="Task description..."
							rows={3}
						/>
					</div>
					<div>
						<Label htmlFor="task-due-date">Due Date (Optional)</Label>
						<Input
							id="task-due-date"
							type="date"
							value={taskDueDate}
							onChange={(e) => onTaskDueDateChange(e.target.value)}
						/>
					</div>
					<div className="flex justify-end gap-2">
						<Button variant="outline" onClick={onClose}>
							Cancel
						</Button>
						<Button onClick={onCreateTask}>Create Task</Button>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
};
