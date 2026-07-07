"use client";

import {
	CheckSquare,
	Filter,
	LayoutGrid,
	type LucideIcon,
	MessageSquare,
} from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export type EventType = "message" | "board-card" | "task";

export type CalendarFilterOptions = {
	eventTypes: EventType[];
};

// Single source of truth for per-event-type color and copy, shared by the
// filter trigger dots and the toggle rows below. Keep in sync with the
// count-badge colors in calendar-header.tsx.
const EVENT_TYPE_META: Record<
	EventType,
	{
		label: string;
		icon: LucideIcon;
		dotColor: string;
		iconColor: string;
		labelColor: string;
		switchColor: string;
	}
> = {
	message: {
		label: "Message Events",
		icon: MessageSquare,
		dotColor: "bg-blue-500",
		iconColor: "text-blue-500 dark:text-blue-400",
		labelColor: "text-blue-700 dark:text-blue-400",
		switchColor: "data-[state=checked]:bg-blue-500",
	},
	"board-card": {
		label: "Board Assignments",
		icon: LayoutGrid,
		dotColor: "bg-purple-500",
		iconColor: "text-purple-500 dark:text-purple-400",
		labelColor: "text-purple-700 dark:text-purple-400",
		switchColor: "data-[state=checked]:bg-purple-500",
	},
	task: {
		label: "My Tasks",
		icon: CheckSquare,
		dotColor: "bg-green-500",
		iconColor: "text-green-500 dark:text-green-400",
		labelColor: "text-green-700 dark:text-green-400",
		switchColor: "data-[state=checked]:bg-green-500",
	},
};

const EVENT_TYPE_ORDER: EventType[] = ["message", "board-card", "task"];

interface CalendarFilterProps {
	filterOptions: CalendarFilterOptions;
	onFilterChange: (options: Partial<CalendarFilterOptions>) => void;
}

export const CalendarFilter = ({
	filterOptions,
	onFilterChange,
}: CalendarFilterProps) => {
	const [isFiltersOpen, setIsFiltersOpen] = useState(false);

	const toggleEventType = (type: EventType) => {
		const currentTypes = [...filterOptions.eventTypes];
		const index = currentTypes.indexOf(type);

		if (index === -1) {
			// Add the type if it's not already selected
			onFilterChange({ eventTypes: [...currentTypes, type] });
		} else {
			// Remove the type if it's already selected
			currentTypes.splice(index, 1);
			onFilterChange({ eventTypes: currentTypes });
		}
	};

	const isEventTypeSelected = (type: EventType) => {
		return filterOptions.eventTypes.includes(type);
	};

	const allTypesSelected = filterOptions.eventTypes.length === 3; // All 3 types selected

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						className={cn(
							"flex items-center gap-1.5 border rounded-md transition-all",
							filterOptions.eventTypes.length > 0 &&
								filterOptions.eventTypes.length < 3 &&
								"bg-muted border-border"
						)}
						variant="outline"
					>
						<Filter className="h-4 w-4" />
						<span>Filter</span>
						{filterOptions.eventTypes.length > 0 &&
							filterOptions.eventTypes.length < 3 && (
								<div
									aria-label={`${filterOptions.eventTypes.length} of 3 event types shown`}
									className="flex ml-1 gap-1"
									role="img"
								>
									{EVENT_TYPE_ORDER.filter((type) =>
										filterOptions.eventTypes.includes(type)
									).map((type) => (
										<div
											className={cn(
												"w-2 h-2 rounded-full",
												EVENT_TYPE_META[type].dotColor
											)}
											key={type}
										/>
									))}
								</div>
							)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel className="flex items-center justify-between">
						<span>Event Types</span>
						<Button
							className="h-7 text-xs px-2"
							onClick={() =>
								onFilterChange({
									eventTypes: allTypesSelected ? [] : EVENT_TYPE_ORDER,
								})
							}
							size="sm"
							variant="ghost"
						>
							{allTypesSelected ? "Clear All" : "Select All"}
						</Button>
					</DropdownMenuLabel>
					<DropdownMenuSeparator />

					<div className="p-2 space-y-3">
						{EVENT_TYPE_ORDER.map((type) => {
							const meta = EVENT_TYPE_META[type];
							const Icon = meta.icon;
							const id = `${type}-events`;

							return (
								<div
									className="flex items-center justify-between space-x-2"
									key={type}
								>
									<div className="flex items-center space-x-2">
										<Icon className={cn("h-4 w-4", meta.iconColor)} />
										<Label
											className={cn("cursor-pointer", meta.labelColor)}
											htmlFor={id}
										>
											{meta.label}
										</Label>
									</div>
									<Switch
										checked={isEventTypeSelected(type)}
										className={meta.switchColor}
										id={id}
										onCheckedChange={() => toggleEventType(type)}
									/>
								</div>
							);
						})}
					</div>
				</DropdownMenuContent>
			</DropdownMenu>
		</div>
	);
};
