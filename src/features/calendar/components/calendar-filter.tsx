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
// + label, not color — quiet chips. Labels match the count chips in
// calendar-header.tsx and the event-card meta lines in page.tsx, so each
// event type has one name everywhere. Switches fall back to the Switch
// primitive's default (primary when checked).
const EVENT_TYPE_META: Record<
	EventType,
	{
		label: string;
		icon: LucideIcon;
	}
> = {
	message: {
		label: "Messages",
		icon: MessageSquare,
	},
	"board-card": {
		label: "Board cards",
		icon: LayoutGrid,
	},
	task: {
		label: "Tasks",
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

	const allTypesSelected =
		filterOptions.eventTypes.length === EVENT_TYPE_ORDER.length;
	const someTypesHidden =
		filterOptions.eventTypes.length > 0 && !allTypesSelected;

	return (
		<div className="flex items-center gap-2">
			<DropdownMenu onOpenChange={setIsFiltersOpen} open={isFiltersOpen}>
				<DropdownMenuTrigger asChild>
					<Button
						className={cn(
							"flex items-center gap-1.5 transition-standard",
							someTypesHidden && "border-border bg-muted"
						)}
						variant="outline"
					>
						<Filter className="size-4" />
						<span>Filter</span>
						{someTypesHidden && (
							<div
								aria-label={`${filterOptions.eventTypes.length} of ${EVENT_TYPE_ORDER.length} event types shown`}
								className="ml-1 flex gap-1"
								role="img"
							>
								{EVENT_TYPE_ORDER.filter((type) =>
									filterOptions.eventTypes.includes(type)
								).map((type) => (
									<div className="size-2 rounded-full bg-primary" key={type} />
								))}
							</div>
						)}
					</Button>
				</DropdownMenuTrigger>
				<DropdownMenuContent align="end" className="w-64">
					<DropdownMenuLabel className="flex items-center justify-between">
						<span>Event types</span>
						<Button
							className="h-7 px-2 text-xs"
							onClick={() =>
								onFilterChange({
									eventTypes: allTypesSelected ? [] : EVENT_TYPE_ORDER,
								})
							}
							size="sm"
							variant="ghost"
						>
							{allTypesSelected ? "Clear all" : "Select all"}
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
									className="flex items-center justify-between gap-2"
									key={type}
								>
									<div className="flex items-center gap-2">
										<Icon className="size-4 text-muted-foreground" />
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
