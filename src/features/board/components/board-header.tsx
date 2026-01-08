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
	onSearchListName?: (query: string) => void;
}

const BoardHeader: React.FC<BoardHeaderProps> = ({
	totalCards,
	listsCount,
	view,
	setView,
	onAddList,
	onSearch,
	onSearchListName,
}) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [listNameQuery, setListNameQuery] = useState("");

	const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setSearchQuery(value);
		if (onSearch) onSearch(value);
	};

	const handleListNameSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		setListNameQuery(value);
		if (onSearchListName) onSearchListName(value);
	};

	const handleSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (onSearch) onSearch(searchQuery);
	};

	const handleListNameSearch = (e: React.FormEvent) => {
		e.preventDefault();
		if (onSearchListName) onSearchListName(listNameQuery);
	};

	return (
		<div className="flex flex-col gap-3 p-4 border-b dark:border-gray-800 bg-gradient-to-r from-secondary/5 to-secondary/5 dark:from-gray-900 dark:to-gray-900">
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground dark:text-gray-400">
						<div className="flex items-center gap-1">
							<LayoutGrid className="w-4 h-4" />
							<span>{listsCount} lists</span>
						</div>
						<div className="flex items-center gap-1">
							<BarChart className="w-4 h-4" />
							<span>{totalCards} cards</span>
						</div>
						<Badge variant="outline" className="bg-white/50 dark:bg-gray-800/50 dark:border-gray-700">
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
									className="h-9 px-3 bg-white dark:bg-gray-800 dark:border-gray-700"
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
								className="h-9 w-9 bg-white dark:bg-gray-800 dark:border-gray-700"
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
				<div className="flex items-center gap-2 w-full sm:w-auto">
					<form onSubmit={handleSearch} className="relative w-full sm:w-64">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-gray-500" />
						<Input
							placeholder="Search tasks"
							className="pl-9 bg-white/80 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 w-full"
							value={searchQuery}
							onChange={handleSearchChange}
						/>
					</form>
					
					{view === "kanban" && (
						<form onSubmit={handleListNameSearch} className="relative w-full sm:w-64">
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-gray-500" />
							<Input
								placeholder="Search Cards"
								className="pl-9 bg-white/80 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 w-full"
								value={listNameQuery}
								onChange={handleListNameSearchChange}
							/>
						</form>
					)}
				</div>

				<div className="flex flex-col">
					<div className="flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 p-1 rounded-lg border dark:border-gray-700 shadow-sm">
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"px-3 py-1.5 flex items-center gap-2 rounded-md transition-all duration-200",
								view === "kanban"
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("kanban")}
						>
							<LayoutGrid
								className={cn(
									"w-4 h-4",
									view === "kanban" ? "text-secondary dark:text-secondary-foreground" : "text-gray-500 dark:text-gray-400"
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
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("table")}
						>
							<Table
								className={cn(
									"w-4 h-4",
									view === "table" ? "text-secondary dark:text-secondary-foreground" : "text-gray-500 dark:text-gray-400"
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
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("gantt")}
						>
							<GanttChart
								className={cn(
									"w-4 h-4",
									view === "gantt" ? "text-secondary dark:text-secondary-foreground" : "text-gray-500 dark:text-gray-400"
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
