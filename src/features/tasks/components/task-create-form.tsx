"use client";

import { format } from "date-fns";
import { CalendarIcon, Plus, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
import { LimitIndicator } from "@/components/limit-indicator";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
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
import { Textarea } from "@/components/ui/textarea";
import { useWorkspaceLimit } from "@/hooks/use-workspace-limit";
import { cn } from "@/lib/utils";
import { useCreateTask } from "../api/use-create-task";
import { TaskCategorySelector } from "./task-category-selector";

interface TaskCreateFormProps {
	workspaceId: Id<"workspaces">;
	onSuccess?: () => void;
}

export const TaskCreateForm = ({
	workspaceId,
	onSuccess,
}: TaskCreateFormProps) => {
	const [isExpanded, setIsExpanded] = useState(false);

	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [dueDate, setDueDate] = useState<Date | undefined>();
	const [priority, setPriority] = useState<
		"low" | "medium" | "high" | undefined
	>();
	const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(null);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const createTask = useCreateTask();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim()) return;

		try {
			setIsSubmitting(true);
			await createTask({
				title,
				description: description || undefined,
				dueDate: dueDate ? dueDate.getTime() : undefined,
				priority,
				status: "not_started",
				categoryId: categoryId || undefined,
				workspaceId,
			});

			// Show success toast
			toast.success("Task created");

			// Reset form
			setTitle("");
			setDescription("");
			setDueDate(undefined);
			setPriority(undefined);
			setCategoryId(null);

			if (onSuccess) {
				onSuccess();
			}
		} catch (error) {
			console.error("Failed to create task:", error);
			toast.error("Failed to create task", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	const handleCancel = () => {
		setIsExpanded(false);
		setTitle("");
		setDescription("");
		setDueDate(undefined);
		setPriority(undefined);
		setCategoryId(null);
	};

	const getPriorityStyles = (value: string) => {
		switch (value) {
			case "high":
				return {
					icon: <div className="size-3 rounded-full bg-warning mr-2" />,
					label: "High Priority",
				};
			case "medium":
				return {
					icon: <div className="size-3 rounded-full bg-primary mr-2" />,
					label: "Medium Priority",
				};
			case "low":
				return {
					icon: (
						<div className="size-3 rounded-full bg-muted-foreground/60 mr-2" />
					),
					label: "Low Priority",
				};
			default:
				return {
					icon: (
						<div className="size-3 rounded-full border-2 border-dashed border-border mr-2" />
					),
					label: "Set priority (optional)",
				};
		}
	};

	const { maxReached } = useWorkspaceLimit("task");

	if (!isExpanded) {
		return (
			<div className="space-y-2">
				{maxReached && (
					<div className="flex items-center justify-between rounded-md border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
						<span>
							You have reached the task limit for your plan. Upgrade to create
							tasks.
						</span>
						<LimitIndicator featureLabel="Tasks" />
					</div>
				)}
				<Button
					className="w-full gap-2 py-6 shadow-sm hover:shadow-md"
					disabled={maxReached}
					onClick={() => {
						if (!maxReached) setIsExpanded(true);
					}}
					variant="default"
				>
					<Plus className="size-5" />
					<span className="font-semibold text-base">
						{maxReached ? "Task limit reached" : "Add new task"}
					</span>
				</Button>
			</div>
		);
	}

	const priorityStyles = getPriorityStyles(priority || "");

	return (
		<form
			className="p-6 rounded-2xl border shadow-sm bg-card"
			onSubmit={handleSubmit}
		>
			<div className="flex justify-between items-center mb-4">
				<h3 className="font-semibold text-lg text-foreground">Create task</h3>
				<Button
					aria-label="Cancel"
					onClick={handleCancel}
					size="iconSm"
					type="button"
					variant="ghost"
				>
					<X className="size-4" />
				</Button>
			</div>

			<div className="space-y-4">
				<Input
					className="text-base font-medium"
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Task title"
					required
					value={title}
				/>

				<Textarea
					className="min-h-[100px] resize-none"
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					value={description}
				/>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
					<div>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									className={cn(
										"w-full justify-start text-left font-normal",
										!dueDate ? "text-muted-foreground" : "text-foreground"
									)}
									type="button"
									variant="outline"
								>
									<CalendarIcon className="mr-2 size-4 text-muted-foreground" />
									{dueDate ? (
										format(dueDate, "PPP")
									) : (
										<span>Due date (optional)</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-auto p-0">
								<Calendar
									className="border rounded-md shadow-md"
									onSelect={setDueDate}
									selected={dueDate}
								/>
								{dueDate && (
									<div className="p-2 border-t flex justify-end">
										<Button
											className="text-destructive hover:bg-destructive/10 hover:text-destructive text-xs"
											onClick={() => setDueDate(undefined)}
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

					<div>
						<Select
							onValueChange={(value: string) =>
								setPriority(value as "low" | "medium" | "high")
							}
							value={priority}
						>
							<SelectTrigger>
								<SelectValue placeholder="Set priority (optional)">
									<div className="flex items-center">
										{priorityStyles.icon}
										{priorityStyles.label}
									</div>
								</SelectValue>
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-warning mr-2" />
										High Priority
									</div>
								</SelectItem>
								<SelectItem value="medium">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-primary mr-2" />
										Medium Priority
									</div>
								</SelectItem>
								<SelectItem value="low">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-muted-foreground/60 mr-2" />
										Low Priority
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div className="pt-2">
					<div className="text-sm font-medium block mb-2 text-foreground">
						Category (optional)
					</div>
					<TaskCategorySelector
						onChange={setCategoryId}
						value={categoryId}
						workspaceId={workspaceId}
					/>
				</div>
			</div>

			<div className="flex justify-end gap-3 pt-5 mt-4 border-t">
				<Button
					disabled={isSubmitting}
					onClick={handleCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={!title.trim() || isSubmitting} type="submit">
					{isSubmitting ? "Creating..." : "Create task"}
				</Button>
			</div>
		</form>
	);
};
