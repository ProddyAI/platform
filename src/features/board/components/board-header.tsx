import {
	BarChart,
	Clock,
	Filter,
	GanttChart,
	LayoutGrid,
	Search,
	Table,
} from "lucide-react";
import type React from "react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardHeaderProps {
	title?: string;
	totalCards: number;
	listsCount: number;
	view: "kanban" | "table" | "gantt";
	setView: (view: "kanban" | "table" | "gantt") => void;
	onAddList: () => void;
	onSearch?: (query: string) => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({
	totalCards,
	listsCount,
	view,
	setView,
	onAddList,
	onSearch,
}) => {
	const [searchQuery, setSearchQuery] = useState("");

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (onSearch) onSearch(searchQuery);
	};

	return (
		<div className="flex flex-col gap-3 p-4 border-b bg-gradient-to-r from-secondary/5 to-secondary/5">
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
						<div className="flex items-center gap-1">
							<LayoutGrid className="w-4 h-4" />
							<span>{listsCount} lists</span>
						</div>
						<div className="flex items-center gap-1">
							<BarChart className="w-4 h-4" />
							<span>{totalCards} cards</span>
						</div>
						<Badge variant="outline" className="bg-white/50">
							<Clock className="w-3 h-3 mr-1" /> Updated just now
						</Badge>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									variant="outline"
									size="sm"
									className="h-9 px-3 bg-white"
									onClick={onAddList}
								>
									<span className="hidden md:inline mr-1">Add List</span>+
								</Button>
							</TooltipTrigger>
							<TooltipContent>
								<p>Add a new list to the board</p>
							</TooltipContent>
						</Tooltip>
					</TooltipProvider>

					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="outline"
								size="icon"
								className="h-9 w-9 bg-white"
							>
								<Filter className="h-4 w-4" />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="end" className="w-56">
							<DropdownMenuLabel>Filter Cards</DropdownMenuLabel>
							<DropdownMenuSeparator />
							<DropdownMenuGroup>
								<DropdownMenuItem>
									<span>By Priority</span>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<span>By Label</span>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<span>By Due Date</span>
								</DropdownMenuItem>
							</DropdownMenuGroup>
							<DropdownMenuSeparator />
							<DropdownMenuItem>
								<span>Clear Filters</span>
							</DropdownMenuItem>
						</DropdownMenuContent>
					</DropdownMenu>
				</div>
			</div>

			<div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
				<form onSubmit={handleSearch} className="relative w-full max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						placeholder="Search cards..."
						className="pl-9 bg-white/80 w-full"
						value={searchQuery}
						onChange={(e) => setSearchQuery(e.target.value)}
					/>
				</form>

				<div className="flex flex-col">
					<div className="flex items-center gap-1 bg-white/90 p-1 rounded-lg border shadow-sm">
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"px-3 py-1.5 flex items-center gap-2 rounded-md transition-all duration-200",
								view === "kanban"
									? "bg-secondary/15 text-secondary font-medium shadow-sm border-secondary/20 border"
									: "hover:bg-gray-100 text-gray-700"
							)}
							onClick={() => setView("kanban")}
						>
							<LayoutGrid
								className={cn(
									"w-4 h-4",
									view === "kanban" ? "text-secondary" : "text-gray-500"
								)}
							/>
							<span className="text-xs font-medium">Kanban</span>
						</Button>

						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"px-3 py-1.5 flex items-center gap-2 rounded-md transition-all duration-200",
								view === "table"
									? "bg-secondary/15 text-secondary font-medium shadow-sm border-secondary/20 border"
									: "hover:bg-gray-100 text-gray-700"
							)}
							onClick={() => setView("table")}
						>
							<Table
								className={cn(
									"w-4 h-4",
									view === "table" ? "text-secondary" : "text-gray-500"
								)}
							/>
							<span className="text-xs font-medium">Table</span>
						</Button>

						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"px-3 py-1.5 flex items-center gap-2 rounded-md transition-all duration-200",
								view === "gantt"
									? "bg-secondary/15 text-secondary font-medium shadow-sm border-secondary/20 border"
									: "hover:bg-gray-100 text-gray-700"
							)}
							onClick={() => setView("gantt")}
						>
							<GanttChart
								className={cn(
									"w-4 h-4",
									view === "gantt" ? "text-secondary" : "text-gray-500"
								)}
							/>
							<span className="text-xs font-medium">Gantt</span>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default BoardHeader;
