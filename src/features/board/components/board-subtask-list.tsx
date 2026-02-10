"use client";

import { useMutation, useQuery } from "convex/react";
import { Check, Plus, Trash2, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardSubtaskListProps {
	parentCardId: Id<"cards">;
	members?: any[];
}

export const BoardSubtaskList: React.FC<BoardSubtaskListProps> = ({
	parentCardId,
	members = [],
}) => {
	const [isAdding, setIsAdding] = useState(false);
	const [newSubtaskTitle, setNewSubtaskTitle] = useState("");

	const subtasks = useQuery(api.board.getSubtasks, { parentCardId });
	const createSubtask = useMutation(api.board.createSubtask);
	const toggleCompletion = useMutation(api.board.toggleCardCompletion);
	const deleteCard = useMutation(api.board.deleteCard);

	const handleAddSubtask = async () => {
		if (!newSubtaskTitle.trim()) return;

		try {
			await createSubtask({
				parentCardId,
				title: newSubtaskTitle.trim(),
			});
			setNewSubtaskTitle("");
			setIsAdding(false);
		} catch (error) {
			console.error("Failed to create subtask:", error);
		}
	};

	const handleToggleCompletion = async (subtaskId: Id<"cards">) => {
		try {
			await toggleCompletion({ cardId: subtaskId });
		} catch (error) {
			console.error("Failed to toggle subtask completion:", error);
		}
	};

	const handleDeleteSubtask = async (subtaskId: Id<"cards">) => {
		try {
			await deleteCard({ cardId: subtaskId });
		} catch (error) {
			console.error("Failed to delete subtask:", error);
		}
	};

	if (!subtasks) {
		return (
			<div className="text-sm text-muted-foreground">Loading subtasks...</div>
		);
	}

	const completedCount = subtasks.filter((s) => s.isCompleted).length;
	const totalCount = subtasks.length;

	return (
		<div className="space-y-3">
			{/* Header with progress */}
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold">Subtasks</h3>
					{totalCount > 0 && (
						<span className="text-xs text-muted-foreground">
							{completedCount}/{totalCount}
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
					Add Subtask
				</Button>
			</div>

			{/* Progress bar */}
			{totalCount > 0 && (
				<div className="w-full bg-muted rounded-full h-1.5">
					<div
						className="bg-primary h-1.5 rounded-full transition-all duration-300"
						style={{ width: `${(completedCount / totalCount) * 100}%` }}
					/>
				</div>
			)}

			{/* Subtask list */}
			<div className="space-y-2">
				{subtasks.map((subtask) => (
					<div
						className="flex items-center gap-2 p-2 rounded-md border bg-card hover:bg-accent/50 transition-colors group"
						key={subtask._id}
					>
						<Checkbox
							checked={subtask.isCompleted || false}
							className="shrink-0"
							onCheckedChange={() => handleToggleCompletion(subtask._id)}
						/>
						<span
							className={cn(
								"flex-1 text-sm",
								subtask.isCompleted && "line-through text-muted-foreground"
							)}
						>
							{subtask.title}
						</span>

						{/* Subtask assignees */}
						{subtask.assignees && subtask.assignees.length > 0 && (
							<div className="flex -space-x-2">
								{subtask.assignees.slice(0, 2).map((assigneeId) => {
									const member = members.find((m) => m._id === assigneeId);
									const fallback =
										member?.user?.name?.charAt(0).toUpperCase() || "?";

									return (
										<TooltipProvider key={assigneeId}>
											<Tooltip>
												<TooltipTrigger asChild>
													<Avatar className="h-5 w-5 border border-background">
														<AvatarImage
															alt={member?.user?.name}
															src={member?.user?.image}
														/>
														<AvatarFallback className="text-[9px]">
															{fallback}
														</AvatarFallback>
													</Avatar>
												</TooltipTrigger>
												<TooltipContent>
													<p>{member?.user?.name || "Unknown user"}</p>
												</TooltipContent>
											</Tooltip>
										</TooltipProvider>
									);
								})}
							</div>
						)}

						{/* Delete button (shown on hover) */}
						<Button
							className="opacity-0 group-hover:opacity-100 transition-opacity"
							onClick={() => handleDeleteSubtask(subtask._id)}
							size="iconSm"
							variant="ghost"
						>
							<Trash2 className="w-3.5 h-3.5" />
						</Button>
					</div>
				))}
			</div>

			{/* Add subtask input */}
			{isAdding && (
				<div className="flex items-center gap-2 p-2 rounded-md border bg-card">
					<Checkbox className="shrink-0" disabled />
					<Input
						autoFocus
						className="flex-1 h-7 text-sm"
						onChange={(e) => setNewSubtaskTitle(e.target.value)}
						onKeyDown={(e) => {
							if (e.key === "Enter") {
								handleAddSubtask();
							} else if (e.key === "Escape") {
								setIsAdding(false);
								setNewSubtaskTitle("");
							}
						}}
						placeholder="Subtask title..."
						value={newSubtaskTitle}
					/>
					<Button
						disabled={!newSubtaskTitle.trim()}
						onClick={handleAddSubtask}
						size="iconSm"
						variant="ghost"
					>
						<Check className="w-3.5 h-3.5 text-green-600" />
					</Button>
					<Button
						onClick={() => {
							setIsAdding(false);
							setNewSubtaskTitle("");
						}}
						size="iconSm"
						variant="ghost"
					>
						<X className="w-3.5 h-3.5" />
					</Button>
				</div>
			)}

			{/* Empty state */}
			{!isAdding && totalCount === 0 && (
				<div className="text-center py-6 text-sm text-muted-foreground">
					No subtasks yet. Click "Add Subtask" to break down this task.
				</div>
			)}
		</div>
	);
};
