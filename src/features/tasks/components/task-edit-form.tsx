"use client";

import { format } from "date-fns";
import { CalendarIcon } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import type { Id } from "@/../convex/_generated/dataModel";
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
import { cn } from "@/lib/utils";

import { useUpdateTask } from "../api/use-update-task";
import { TaskCategorySelector } from "./task-category-selector";

interface TaskEditFormProps {
	id: Id<"tasks">;
	workspaceId: Id<"workspaces">;
	initialTitle: string;
	initialDescription?: string;
	initialDueDate?: Date;
	initialPriority?: "low" | "medium" | "high";
	initialCategoryId?: Id<"categories">;
	onCancel: () => void;
	onSave: () => void;
}

export const TaskEditForm = ({
	id,
	workspaceId,
	initialTitle,
	initialDescription = "",
	initialDueDate,
	initialPriority,
	initialCategoryId,
	onCancel,
	onSave,
}: TaskEditFormProps) => {
	const [title, setTitle] = useState(initialTitle);
	const [description, setDescription] = useState(initialDescription);
	const [dueDate, setDueDate] = useState<Date | undefined>(initialDueDate);
	const [priority, setPriority] = useState<
		"low" | "medium" | "high" | undefined
	>(initialPriority);
	const [categoryId, setCategoryId] = useState<Id<"categories"> | null>(
		initialCategoryId || null
	);

	const [isSubmitting, setIsSubmitting] = useState(false);
	const updateTask = useUpdateTask();

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!title.trim()) return;

		setIsSubmitting(true);
		try {
			await updateTask({
				id,
				title,
				description: description || undefined,
				dueDate: dueDate ? dueDate.getTime() : undefined,
				priority,
				categoryId: categoryId || undefined,
			});
			onSave();
		} catch (error) {
			toast.error("Couldn't save task changes", {
				description:
					error instanceof Error ? error.message : "Please try again",
			});
		} finally {
			setIsSubmitting(false);
		}
	};

	return (
		<form
			className="p-4 rounded-2xl border bg-card shadow-md"
			onSubmit={handleSubmit}
		>
			<div className="space-y-3">
				<Input
					autoFocus
					className="font-medium"
					onChange={(e) => setTitle(e.target.value)}
					placeholder="Task title"
					required
					value={title}
				/>
				<Textarea
					className="min-h-[80px] resize-none"
					onChange={(e) => setDescription(e.target.value)}
					placeholder="Description (optional)"
					value={description}
				/>

				<div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
					<div>
						<Popover>
							<PopoverTrigger asChild>
								<Button
									className={cn(
										"w-full justify-start text-left font-normal",
										!dueDate && "text-muted-foreground"
									)}
									type="button"
									variant="outline"
								>
									<CalendarIcon className="mr-2 size-4" />
									{dueDate ? (
										format(dueDate, "PPP")
									) : (
										<span>Due date (optional)</span>
									)}
								</Button>
							</PopoverTrigger>
							<PopoverContent align="start" className="w-auto p-0">
								<Calendar onSelect={setDueDate} selected={dueDate} />
								{dueDate && (
									<div className="flex justify-end border-t p-2">
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
								<SelectValue placeholder="Set priority (optional)" />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="high">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-warning mr-2" />
										High priority
									</div>
								</SelectItem>
								<SelectItem value="medium">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-primary mr-2" />
										Medium priority
									</div>
								</SelectItem>
								<SelectItem value="low">
									<div className="flex items-center">
										<div className="size-3 rounded-full bg-muted-foreground/60 mr-2" />
										Low priority
									</div>
								</SelectItem>
							</SelectContent>
						</Select>
					</div>
				</div>

				<div>
					<div className="text-sm font-medium block mb-2">
						Category (optional)
					</div>
					<TaskCategorySelector
						onChange={setCategoryId}
						value={categoryId}
						workspaceId={workspaceId}
					/>
				</div>
			</div>

			<div className="flex justify-end gap-2 pt-4 mt-2 border-t">
				<Button
					disabled={isSubmitting}
					onClick={onCancel}
					type="button"
					variant="outline"
				>
					Cancel
				</Button>
				<Button disabled={!title.trim() || isSubmitting} type="submit">
					{isSubmitting ? "Saving..." : "Save"}
				</Button>
			</div>
		</form>
	);
};
