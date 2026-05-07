"use client";

import { Check, Clock, Pause, Play, X } from "lucide-react";

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
import { cn } from "@/lib/utils";

type TaskStatus =
	| "not_started"
	| "in_progress"
	| "completed"
	| "on_hold"
	| "cancelled";

interface TaskStatusSelectorProps {
	value: TaskStatus;
	onChange: (value: TaskStatus) => void;
}

const statusOptions: {
	value: TaskStatus;
	label: string;
	icon: React.ReactNode;
	color: string;
}[] = [
	{
		value: "not_started",
		label: "Not Started",
		icon: <Clock className="h-4 w-4" />,
		color: "text-gray-500",
	},
	{
		value: "in_progress",
		label: "In Progress",
		icon: <Play className="h-4 w-4" />,
		color: "text-blue-500",
	},
	{
		value: "completed",
		label: "Completed",
		icon: <Check className="h-4 w-4" />,
		color: "text-green-500",
	},
	{
		value: "on_hold",
		label: "On Hold",
		icon: <Pause className="h-4 w-4" />,
		color: "text-amber-500",
	},
	{
		value: "cancelled",
		label: "Cancelled",
		icon: <X className="h-4 w-4" />,
		color: "text-red-500",
	},
];

export const TaskStatusSelector = ({
	value,
	onChange,
}: TaskStatusSelectorProps) => {
	const selectedStatus = statusOptions.find((status) => status.value === value);

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button
					className="w-full justify-between"
					role="combobox"
					variant="outline"
				>
					<div className="flex items-center gap-2">
						{selectedStatus ? (
							<>
								<span className={cn(selectedStatus.color)}>
									{selectedStatus.icon}
								</span>
								<span>{selectedStatus.label}</span>
							</>
						) : (
							<span className="text-muted-foreground">Select status</span>
						)}
					</div>
				</Button>
			</PopoverTrigger>
			<PopoverContent align="start" className="w-full p-0">
				<Command>
					<CommandInput placeholder="Search status..." />
					<CommandList>
						<CommandEmpty>No status found.</CommandEmpty>
						<CommandGroup>
							{statusOptions.map((status) => (
								<CommandItem
									className="flex items-center gap-2"
									key={status.value}
									onSelect={() => onChange(status.value)}
								>
									<div className="flex h-4 w-4 items-center justify-center">
										{value === status.value && <Check className="h-3 w-3" />}
									</div>
									<span className={cn(status.color)}>{status.icon}</span>
									<span>{status.label}</span>
								</CommandItem>
							))}
						</CommandGroup>
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
};
