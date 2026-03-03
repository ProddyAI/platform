import { GanttChart, LayoutGrid, Plus, Search, Table } from "lucide-react";
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
	view: "kanban" | "table" | "gantt";
	setView: (view: "kanban" | "table" | "gantt") => void;
	onAddStatus?: () => void;
	onSearch?: (query: string) => void;
}

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
			{/* Left: stats */}
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

			{/* Center: search */}
			<div className="flex-1 min-w-0 max-w-xs relative">
				<Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/60" />
				<Input
					className="pl-8 h-8 text-sm bg-muted/40 dark:bg-gray-800/60 border-border/40 dark:border-gray-700 placeholder:text-muted-foreground/40"
					onChange={handleSearchChange}
					placeholder="Search issues..."
					value={searchQuery}
				/>
			</div>

			{/* Right: view switcher + add status */}
			<div className="flex items-center gap-2">
				{/* View switcher */}
				<div className="flex items-center bg-muted/50 dark:bg-gray-800/60 rounded-lg p-0.5 border border-border/40 dark:border-gray-700">
					{(
						[
							{ id: "kanban", icon: LayoutGrid, label: "Board" },
							{ id: "table", icon: Table, label: "Table" },
							{ id: "gantt", icon: GanttChart, label: "Gantt" },
						] as const
					).map(({ id, icon: Icon, label }) => (
						<Button
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

				{/* Add Status */}
				{view === "kanban" && (
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									className="h-8 gap-1.5 text-xs border-border/50 dark:border-gray-700 bg-transparent hover:bg-muted/60 dark:hover:bg-gray-800"
									onClick={onAddStatus}
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
				)}
			</div>
		</div>
	);
};

export default BoardHeader;
