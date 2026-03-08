import { GanttChart, LayoutGrid, Plus, Search } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardHeaderProps {
	totalIssues: number;
	statusCount: number;
	view: "kanban" | "gantt";
	setView: (view: "kanban" | "gantt") => void;
	onAddStatus?: () => void;
	onSearch?: (query: string) => void;
}

interface StatusStatsProps {
	totalIssues: number;
	statusCount: number;
}

const StatusStats = ({ totalIssues, statusCount }: StatusStatsProps) => (
	<div className="flex items-center gap-3 text-xs text-muted-foreground">
		<span className="flex items-center gap-1.5">
			<span className="w-2 h-2 rounded-full bg-primary/60" />
			<span>
				<strong className="text-foreground">{statusCount}</strong>{" "}
				{statusCount === 1 ? "status" : "statuses"}
			</span>
		</span>
		<span className="text-border/60">·</span>
		<span>
			<strong className="text-foreground">{totalIssues}</strong>{" "}
			{totalIssues === 1 ? "issue" : "issues"}
		</span>
	</div>
);

interface ViewSwitcherProps {
	view: "kanban" | "gantt";
	setView: (view: "kanban" | "gantt") => void;
}

const ViewSwitcher = ({ view, setView }: ViewSwitcherProps) => (
	<div className="flex items-center bg-muted/50 dark:bg-gray-800/60 rounded-lg p-0.5 border border-border/40 dark:border-gray-700">
		{(
			[
				{ id: "kanban", icon: LayoutGrid, label: "Board" },
				{ id: "gantt", icon: GanttChart, label: "Gantt" },
			] as const
		).map(({ id, icon: Icon, label }) => (
			<Button
				aria-label={label}
				className={cn(
					"h-7 px-2.5 flex items-center gap-1.5 rounded-md text-xs transition-all",
					view === id
						? "bg-background dark:bg-gray-900 text-foreground shadow-sm"
						: "text-muted-foreground hover:text-foreground"
				)}
				key={id}
				onClick={() => setView(id)}
				size="sm"
				variant="ghost"
			>
				<Icon className="w-3.5 h-3.5" />
				<span className="hidden sm:inline">{label}</span>
			</Button>
		))}
	</div>
);

interface AddStatusButtonProps {
	onClick?: () => void;
}

const AddStatusButton = ({ onClick }: AddStatusButtonProps) => (
	<TooltipProvider>
		<Tooltip>
			<TooltipTrigger asChild>
				<Button
					aria-label="Add status"
					className="h-8 gap-1.5 text-xs border-border/50 dark:border-gray-700 bg-transparent hover:bg-muted/60 dark:hover:bg-gray-800"
					onClick={onClick}
					size="sm"
					variant="outline"
				>
					<Plus className="w-3.5 h-3.5" />
					<span className="hidden md:inline">Add Status</span>
				</Button>
			</TooltipTrigger>
			<TooltipContent>Add a new status column</TooltipContent>
		</Tooltip>
	</TooltipProvider>
);

interface SearchInputProps {
	value: string;
	onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

const SearchInput = ({ value, onChange }: SearchInputProps) => (
	<div className="flex-1 min-w-0 max-w-xs relative">
		<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
		<Input
			className="pl-8 h-8 text-sm bg-muted/40 dark:bg-gray-800/60 border-border/40 dark:border-gray-700 placeholder:text-muted-foreground/40"
			onChange={onChange}
			placeholder="Search issues..."
			value={value}
		/>
	</div>
);

const BoardHeader: React.FC<BoardHeaderProps> = ({
	totalIssues,
	statusCount,
	view,
	setView,
	onAddStatus,
	onSearch,
}) => {
	const [searchQuery, setSearchQuery] = useState("");

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchQuery(value);
		onSearch?.(value);
	};

	return (
		<div className="flex w-full min-w-0 max-w-full items-center justify-between gap-3 px-4 py-2.5 border-b border-border/60 dark:border-gray-800 bg-background dark:bg-gray-950 overflow-x-hidden">
			<StatusStats statusCount={statusCount} totalIssues={totalIssues} />

			<SearchInput onChange={handleSearchChange} value={searchQuery} />

			<div className="flex items-center gap-2">
				{view === "kanban" && <AddStatusButton onClick={onAddStatus} />}

				<ViewSwitcher setView={setView} view={view} />
			</div>
		</div>
	);
};

export default BoardHeader;
