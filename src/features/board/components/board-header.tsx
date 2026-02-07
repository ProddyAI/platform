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

	const handleListNameSearchChange = (
		e: React.ChangeEvent<HTMLInputElement>
	) => {
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
		<div className="flex flex-col gap-3 p-3 md:p-4 border-b dark:border-gray-800 bg-gradient-to-r from-secondary/5 to-secondary/5 dark:from-gray-900 dark:to-gray-900">
			<div className="flex items-center justify-between">
				<div>
					<div className="flex items-center gap-2 md:gap-3 mt-1 text-xs md:text-sm text-muted-foreground dark:text-gray-400">
						<div className="flex items-center gap-1">
							<LayoutGrid className="w-3 h-3 md:w-4 md:h-4" />
							<span>{listsCount} lists</span>
						</div>
						<div className="flex items-center gap-1">
							<BarChart className="w-3 h-3 md:w-4 md:h-4" />
							<span>{totalCards} cards</span>
						</div>
						<Badge
							className="hidden sm:inline-flex bg-white/50 dark:bg-gray-800/50 dark:border-gray-700"
							variant="outline"
						>
							<Clock className="w-3 h-3 mr-1" /> Updated just now
						</Badge>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<TooltipProvider>
						<Tooltip>
							<TooltipTrigger asChild>
								<Button
									className="h-9 px-3 bg-white dark:bg-gray-800 dark:border-gray-700"
									onClick={onAddList}
									size="sm"
									variant="outline"
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
								className="h-9 w-9 bg-white dark:bg-gray-800 dark:border-gray-700"
								size="icon"
								variant="outline"
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
					<form className="relative w-full sm:w-64" onSubmit={handleSearch}>
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-gray-500" />
						<Input
							className="pl-9 bg-white/80 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 w-full"
							onChange={handleSearchChange}
							placeholder="Search tasks"
							value={searchQuery}
						/>
					</form>

					{view === "kanban" && (
						<form
							className="relative w-full sm:w-64"
							onSubmit={handleListNameSearch}
						>
							<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground dark:text-gray-500" />
							<Input
								className="pl-9 bg-white/80 dark:bg-gray-800/80 dark:border-gray-700 dark:text-gray-100 dark:placeholder:text-gray-500 w-full"
								onChange={handleListNameSearchChange}
								placeholder="Search Cards"
								value={listNameQuery}
							/>
						</form>
					)}
				</div>

				<div className="flex flex-col">
					<div className="flex items-center gap-1 bg-white/90 dark:bg-gray-800/90 p-1 rounded-lg border dark:border-gray-700 shadow-sm">
						<Button
							className={cn(
								"px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2 rounded-md transition-all duration-200",
								view === "kanban"
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("kanban")}
							size="sm"
							variant="ghost"
						>
							<LayoutGrid
								className={cn(
									"w-4 h-4",
									view === "kanban"
										? "text-secondary dark:text-secondary-foreground"
										: "text-gray-500 dark:text-gray-400"
								)}
							/>
							<span className="hidden sm:inline text-xs font-medium">Kanban</span>
						</Button>

						<Button
							className={cn(
								"px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2 rounded-md transition-all duration-200",
								view === "table"
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("table")}
							size="sm"
							variant="ghost"
						>
							<Table
								className={cn(
									"w-4 h-4",
									view === "table"
										? "text-secondary dark:text-secondary-foreground"
										: "text-gray-500 dark:text-gray-400"
								)}
							/>
							<span className="hidden sm:inline text-xs font-medium">Table</span>
						</Button>

						<Button
							className={cn(
								"px-2 md:px-3 py-1.5 flex items-center gap-1 md:gap-2 rounded-md transition-all duration-200",
								view === "gantt"
									? "bg-secondary/15 dark:bg-secondary/25 text-secondary dark:text-secondary-foreground font-medium shadow-sm border-secondary/20 dark:border-secondary/30 border"
									: "hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
							)}
							onClick={() => setView("gantt")}
							size="sm"
							variant="ghost"
						>
							<GanttChart
								className={cn(
									"w-4 h-4",
									view === "gantt"
										? "text-secondary dark:text-secondary-foreground"
										: "text-gray-500 dark:text-gray-400"
								)}
							/>
							<span className="hidden sm:inline text-xs font-medium">Gantt</span>
						</Button>
					</div>
				</div>
			</div>
		</div>
	);
};

export default BoardHeader;
