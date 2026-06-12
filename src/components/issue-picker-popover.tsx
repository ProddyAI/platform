"use client";

import { Check, Plus } from "lucide-react";
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
} from "@/components/ui/command";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	formatIssueId,
	type IssuePriority,
	priorityIcon,
} from "@/features/board/components/board-issue-row";
import { cn } from "@/lib/utils";

export interface PickerIssue {
	_id: Id<"issues">;
	title: string;
	priority?: IssuePriority;
	status: { name: string; color: string } | null;
}

interface IssuePickerPopoverProps {
	issues: PickerIssue[];
	isLoading: boolean;
	isPending?: boolean;
	label?: string;
	emptyHint?: string;
	onConfirm: (issueIds: Id<"issues">[]) => void | Promise<void>;
}

export const IssuePickerPopover = ({
	issues,
	isLoading,
	isPending = false,
	label = "Add issues",
	emptyHint = "Every issue is already here.",
	onConfirm,
}: IssuePickerPopoverProps) => {
	const [open, setOpen] = useState(false);
	const [selected, setSelected] = useState<Set<Id<"issues">>>(new Set());

	const toggle = (issueId: Id<"issues">) => {
		setSelected((prev) => {
			const next = new Set(prev);
			if (next.has(issueId)) next.delete(issueId);
			else next.add(issueId);
			return next;
		});
	};

	const reset = () => setSelected(new Set());

	const handleOpenChange = (next: boolean) => {
		setOpen(next);
		if (!next) reset();
	};

	const handleConfirm = async () => {
		if (selected.size === 0) return;
		await onConfirm([...selected]);
		reset();
		setOpen(false);
	};

	return (
		<Popover onOpenChange={handleOpenChange} open={open}>
			<PopoverTrigger asChild>
				<Button className="h-8 gap-1.5" size="sm" variant="outline">
					<Plus className="size-3.5" />
					{label}
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-[320px] p-0">
				<Command>
					<CommandInput placeholder="Search issues..." />
					<CommandList className="max-h-[280px]">
						<CommandEmpty>
							{isLoading ? "Loading issues..." : emptyHint}
						</CommandEmpty>
						{issues.length > 0 && (
							<CommandGroup>
								{issues.map((issue) => {
									const isSelected = selected.has(issue._id);
									return (
										<CommandItem
											className="flex items-center gap-2"
											key={issue._id}
											onSelect={() => toggle(issue._id)}
											value={`${issue.title} ${formatIssueId(issue._id)}`}
										>
											<div
												className={cn(
													"flex size-4 items-center justify-center rounded-sm border",
													isSelected
														? "border-primary bg-primary text-primary-foreground"
														: "border-muted-foreground/40"
												)}
											>
												{isSelected && <Check className="size-3" />}
											</div>
											<span className="flex-shrink-0">
												{priorityIcon(issue.priority)}
											</span>
											{issue.status && (
												<span
													className="size-2 flex-shrink-0 rounded-full ring-1 ring-inset ring-black/10"
													style={{ backgroundColor: issue.status.color }}
												/>
											)}
											<span className="flex-1 truncate text-sm">
												{issue.title}
											</span>
											<span className="flex-shrink-0 font-mono text-[10px] text-muted-foreground/60">
												{formatIssueId(issue._id)}
											</span>
										</CommandItem>
									);
								})}
							</CommandGroup>
						)}
					</CommandList>
					<div className="flex items-center justify-between gap-2 border-t p-2">
						<span className="text-xs text-muted-foreground">
							{selected.size} selected
						</span>
						<Button
							className="h-7"
							disabled={selected.size === 0 || isPending}
							onClick={handleConfirm}
							size="sm"
						>
							{isPending ? "Adding..." : `Add ${selected.size || ""}`.trim()}
						</Button>
					</div>
				</Command>
			</PopoverContent>
		</Popover>
	);
};
