"use client";

import { Check, Loader, Plus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
	CommandSeparator,
} from "@/components/ui/command";
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
import { cn } from "@/lib/utils";

import { useCreateTaskCategory } from "../api/use-create-task-category";
import { useGetTaskCategories } from "../api/use-get-task-categories";

// Predefined category colors
const CATEGORY_COLORS = [
	{ value: "#4A0D68", label: "Purple" },
	{ value: "#ED128E", label: "Pink" },
	{ value: "#E11D48", label: "Red" },
	{ value: "#F97316", label: "Orange" },
	{ value: "#FACC15", label: "Yellow" },
	{ value: "#22C55E", label: "Green" },
	{ value: "#06B6D4", label: "Cyan" },
	{ value: "#3B82F6", label: "Blue" },
	{ value: "#8B5CF6", label: "Violet" },
	{ value: "#6B7280", label: "Gray" },
];

interface TaskCategorySelectorProps {
	workspaceId: Id<"workspaces">;
	value: Id<"categories"> | null;
	onChange: (value: Id<"categories"> | null) => void;
}

export const TaskCategorySelector = ({
	workspaceId,
	value,
	onChange,
}: TaskCategorySelectorProps) => {
	const [open, setOpen] = useState(false);
	const [createDialogOpen, setCreateDialogOpen] = useState(false);
	const [newCategoryName, setNewCategoryName] = useState("");
	const [newCategoryColor, setNewCategoryColor] = useState(
		CATEGORY_COLORS[0].value
	);

	const { data: categories, isLoading } = useGetTaskCategories({ workspaceId });
	const createCategory = useCreateTaskCategory();

	const selectedCategory = categories?.find(
		(category) => category._id === value
	);

	const handleCreateCategory = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!newCategoryName.trim()) return;

		try {
			const categoryId = await createCategory({
				name: newCategoryName,
				color: newCategoryColor,
				workspaceId,
			});

			onChange(categoryId);
			setNewCategoryName("");
			setNewCategoryColor(CATEGORY_COLORS[0].value);
			setCreateDialogOpen(false);
		} catch (error) {
			console.error("Failed to create category:", error);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<Popover open={open} onOpenChange={setOpen}>
				<PopoverTrigger asChild>
					<Button
						variant="outline"
						role="combobox"
						aria-expanded={open}
						className="w-full justify-between"
					>
						{selectedCategory ? (
							<div className="flex items-center gap-2">
								<div
									className="h-3 w-3 rounded-full"
									style={{ backgroundColor: selectedCategory.color }}
								/>
								<span>{selectedCategory.name}</span>
							</div>
						) : (
							<span className="text-muted-foreground">Select category</span>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent className="w-full p-0" align="start">
					<Command>
						<CommandInput placeholder="Search categories..." />
						<CommandList>
							<CommandEmpty>No categories found.</CommandEmpty>
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										onChange(null);
										setOpen(false);
									}}
									className="flex items-center gap-2"
								>
									<div className="flex h-4 w-4 items-center justify-center">
										{!value && <Check className="h-3 w-3" />}
									</div>
									<span>No category</span>
								</CommandItem>
								{isLoading ? (
									<CommandItem disabled>
										<Loader className="mr-2 h-3 w-3 animate-spin" />
										Loading...
									</CommandItem>
								) : (
									categories?.map((category) => (
										<CommandItem
											key={category._id}
											onSelect={() => {
												onChange(category._id);
												setOpen(false);
											}}
											className="flex items-center gap-2"
										>
											<div className="flex h-4 w-4 items-center justify-center">
												{value === category._id && (
													<Check className="h-3 w-3" />
												)}
											</div>
											<div
												className="h-3 w-3 rounded-full"
												style={{ backgroundColor: category.color }}
											/>
											<span>{category.name}</span>
										</CommandItem>
									))
								)}
							</CommandGroup>
							<CommandSeparator />
							<CommandGroup>
								<CommandItem
									onSelect={() => {
										setOpen(false);
										setCreateDialogOpen(true);
									}}
								>
									<Plus className="mr-2 h-4 w-4" />
									Create category
								</CommandItem>
							</CommandGroup>
						</CommandList>
					</Command>
				</PopoverContent>
			</Popover>

			<Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Create new category</DialogTitle>
						<DialogDescription>
							Add a new category to organize your tasks.
						</DialogDescription>
					</DialogHeader>

					<form onSubmit={handleCreateCategory}>
						<div className="grid gap-4 py-4">
							<div className="grid gap-2">
								<label htmlFor="name" className="text-sm font-medium">
									Name
								</label>
								<Input
									id="name"
									value={newCategoryName}
									onChange={(e) => setNewCategoryName(e.target.value)}
									placeholder="Category name"
									className="w-full"
									required
								/>
							</div>

							<div className="grid gap-2">
								<div className="text-sm font-medium">Color</div>
								<div className="grid grid-cols-5 gap-2">
									{CATEGORY_COLORS.map((color) => (
										<button
											key={color.value}
											type="button"
											onClick={() => setNewCategoryColor(color.value)}
											className={cn(
												"h-8 w-8 rounded-full cursor-pointer flex items-center justify-center border-2",
												newCategoryColor === color.value
													? "border-black dark:border-white"
													: "border-transparent"
											)}
											style={{ backgroundColor: color.value }}
											title={color.label}
										>
											{newCategoryColor === color.value && (
												<Check className="h-4 w-4 text-white" />
											)}
										</button>
									))}
								</div>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreateDialogOpen(false)}
							>
								Cancel
							</Button>
							<Button type="submit">Create</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</div>
	);
};
