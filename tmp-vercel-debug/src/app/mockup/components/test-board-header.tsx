"use client";

import {
	BarChart3,
	Calendar,
	Filter,
	LayoutGrid,
	Plus,
	Search,
	Table,
	Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { TestNavigation } from "@/app/mockup/components/test-navigation";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";

interface TestBoardHeaderProps {
	view: "kanban" | "table" | "gantt";
	onViewChange: (view: "kanban" | "table" | "gantt") => void;
	cardCount: number;
	listCount: number;
}

export const TestBoardHeader = ({
	view,
	onViewChange,
	cardCount,
	listCount,
}: TestBoardHeaderProps) => {
	const router = useRouter();

	const _handleBackToCalendar = () => {
		router.push("/mockup/calendar");
	};

	const _handleBackToDashboard = () => {
		router.push("/mockup/dashboard");
	};

	return (
		<>
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
						variant="ghost"
					>
						<LayoutGrid className="mr-2 size-5" />
						<span className="truncate">Board</span>
					</Button>

					<TestNavigation />
				</div>
			</div>

			<div className="border-b bg-background p-4">
				<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
					{/* Left side - Board info and stats */}
					<div className="flex flex-col gap-2">
						<div className="flex items-center gap-4">
							<div className="flex items-center gap-2">
								<h1 className="text-xl font-semibold">
									Project Management Board
								</h1>
							</div>

							<div className="flex items-center gap-4 text-sm text-muted-foreground">
								<div className="flex items-center gap-1">
									<LayoutGrid className="h-4 w-4" />
									<span>{listCount} lists</span>
								</div>
								<div className="flex items-center gap-1">
									<Calendar className="h-4 w-4" />
									<span>{cardCount} cards</span>
								</div>
								<div className="flex items-center gap-1">
									<Users className="h-4 w-4" />
									<span>4 members</span>
								</div>
							</div>
						</div>
					</div>

					{/* Right side - Actions and view controls */}
					<div className="flex items-center gap-2">
						{/* Search */}
						<div className="relative">
							<Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
							<Input className="w-64 pl-9" placeholder="Search cards..." />
						</div>

						{/* Filter */}
						<DropdownMenu>
							<DropdownMenuTrigger asChild>
								<Button size="sm" variant="outline">
									<Filter className="h-4 w-4 mr-2" />
									Filter
								</Button>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="w-56">
								<DropdownMenuLabel>Filter by</DropdownMenuLabel>
								<DropdownMenuSeparator />
								<DropdownMenuItem>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded-full bg-red-500" />
										High Priority
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded-full bg-orange-500" />
										Medium Priority
									</div>
								</DropdownMenuItem>
								<DropdownMenuItem>
									<div className="flex items-center gap-2">
										<div className="h-3 w-3 rounded-full bg-green-500" />
										Low Priority
									</div>
								</DropdownMenuItem>
								<DropdownMenuSeparator />
								<DropdownMenuItem>Assigned to me</DropdownMenuItem>
								<DropdownMenuItem>Due this week</DropdownMenuItem>
								<DropdownMenuItem>Overdue</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						{/* Add Card */}
						<Button size="sm">
							<Plus className="h-4 w-4 mr-2" />
							Add Card
						</Button>

						{/* View Toggle */}
						<div className="flex items-center border rounded-md">
							<Button
								className="rounded-r-none"
								onClick={() => onViewChange("kanban")}
								size="sm"
								variant={view === "kanban" ? "default" : "ghost"}
							>
								<LayoutGrid className="h-4 w-4" />
								<span className="hidden sm:ml-2 sm:inline">Kanban</span>
							</Button>
							<Button
								className="rounded-none border-x"
								onClick={() => onViewChange("table")}
								size="sm"
								variant={view === "table" ? "default" : "ghost"}
							>
								<Table className="h-4 w-4" />
								<span className="hidden sm:ml-2 sm:inline">Table</span>
							</Button>
							<Button
								className="rounded-l-none"
								onClick={() => onViewChange("gantt")}
								size="sm"
								variant={view === "gantt" ? "default" : "ghost"}
							>
								<BarChart3 className="h-4 w-4" />
								<span className="hidden sm:ml-2 sm:inline">Gantt</span>
							</Button>
						</div>
					</div>
				</div>

				{/* Board Description */}
				<div className="mt-4 text-sm text-muted-foreground">
					<p>
						This is a demo board showcasing project management features with
						sample cards, drag-and-drop functionality, and various priority
						levels. Click on cards to edit them or use the "Add Card" button to
						create new ones.
					</p>
				</div>

				{/* Quick Stats */}
				<div className="mt-4 flex flex-wrap gap-4">
					<div className="flex items-center gap-2 text-sm">
						<div className="h-2 w-2 rounded-full bg-red-600" />
						<span>4 Highest Priority</span>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<div className="h-2 w-2 rounded-full bg-orange-500" />
						<span>8 High Priority</span>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<div className="h-2 w-2 rounded-full bg-yellow-500" />
						<span>10 Medium Priority</span>
					</div>
					<div className="flex items-center gap-2 text-sm">
						<div className="h-2 w-2 rounded-full bg-green-500" />
						<span>3 Low Priority</span>
					</div>
				</div>
			</div>
		</>
	);
};
