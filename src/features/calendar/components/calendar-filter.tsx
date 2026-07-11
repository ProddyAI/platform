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

// Single source of truth for per-event-type copy, shared by the filter
// trigger dots and the toggle rows below. Event types are told apart by icon
// + label, not color — quiet chips, matches the count badges in
// calendar-header.tsx. Switches fall back to the Switch primitive's default
// (primary when checked).
const EVENT_TYPE_META: Record<
	EventType,
	{
		label: string;
		icon: LucideIcon;
	}
> = {
	message: {
		label: "Message Events",
		icon: MessageSquare,
	},
	"board-card": {
		label: "Board Assignments",
		icon: LayoutGrid,
	},
	task: {
		label: "My Tasks",
		icon: CheckSquare,
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
							"flex items-center gap-1.5 transition-standard",
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
											className="w-2 h-2 rounded-full bg-primary"
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
										<Icon className="h-4 w-4 text-muted-foreground" />
										<Label className="cursor-pointer" htmlFor={id}>
											{meta.label}
										</Label>
									</div>
									<Switch
										checked={isEventTypeSelected(type)}
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
