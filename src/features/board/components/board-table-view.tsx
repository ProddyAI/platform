import { formatDistanceToNow } from "date-fns";
import {
	AlertCircle,
	ArrowRightCircle,
	ArrowUpDown,
	CheckCircle2,
	ChevronDown,
	ChevronRight,
	Clock,
	Pencil,
	Search,
	Trash,
} from "lucide-react";
import React, { useMemo, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface BoardTableViewProps {
	lists: any[];
	allCards: any[];
	onEditCard: (card: any) => void;
	onDeleteCard: (cardId: Id<"cards">) => void;
	members?: any[];
}

const BoardTableView: React.FC<BoardTableViewProps> = ({
	lists,
	allCards,
	onEditCard,
	onDeleteCard,
	members = [],
}) => {
	// Create a map of member data for easy lookup
	const memberDataMap = useMemo(() => {
		const map: Record<Id<"members">, { name: string; image?: string }> = {};
		members.forEach((member) => {
			if (member._id) {
				map[member._id] = {
					name: member.user?.name || "Unknown",
					image: member.user?.image,
				};
			}
		});
		return map;
	}, [members]);
	const [sortField, setSortField] = useState<string | null>(null);
	const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
	const [searchQuery, setSearchQuery] = useState("");
	const [expandedParents, setExpandedParents] = useState<
		Record<string, boolean>
	>({});

	const cardsWithListTitle = useMemo(() => {
		return allCards.map((card) => {
			const list = lists.find((l) => l._id === card.listId);
			return {
				...card,
				listTitle: list ? list.title : "Unknown List",
			};
		});
	}, [allCards, lists]);

	const parentCards = useMemo(
		() => cardsWithListTitle.filter((card) => !card.parentCardId),
		[cardsWithListTitle]
	);

	const subtasksByParent = useMemo(() => {
		const map: Record<string, any[]> = {};
		cardsWithListTitle.forEach((card) => {
			if (!card.parentCardId) return;
			const parentId = card.parentCardId as string;
			if (!map[parentId]) {
				map[parentId] = [];
			}
			map[parentId].push(card);
		});
		return map;
	}, [cardsWithListTitle]);

	const sortCards = (cards: any[]) => {
		if (!sortField) return cards;
		return [...cards].sort((a, b) => {
			let valueA;
			let valueB;

			switch (sortField) {
				case "title":
					valueA = a.title.toLowerCase();
					valueB = b.title.toLowerCase();
					break;
				case "list":
					valueA = a.listTitle.toLowerCase();
					valueB = b.listTitle.toLowerCase();
					break;
				case "priority": {
					const priorityOrder = {
						highest: 5,
						high: 4,
						medium: 3,
						low: 2,
						lowest: 1,
						undefined: 0,
					};
					valueA = priorityOrder[a.priority as keyof typeof priorityOrder] || 0;
					valueB = priorityOrder[b.priority as keyof typeof priorityOrder] || 0;
					break;
				}
				default:
					return 0;
			}

			if (valueA < valueB) return sortDirection === "asc" ? -1 : 1;
			if (valueA > valueB) return sortDirection === "asc" ? 1 : -1;
			return 0;
		});
	};

	const searchLower = searchQuery.toLowerCase();
	const matchesQuery = (card: any) => {
		if (!searchLower) return true;
		return (
			card.title.toLowerCase().includes(searchLower) ||
			card.description?.toLowerCase().includes(searchLower) ||
			card.listTitle.toLowerCase().includes(searchLower) ||
			card.labels?.some((label: string) =>
				label.toLowerCase().includes(searchLower)
			)
		);
	};

	const sortedParents = useMemo(
		() => sortCards(parentCards),
		[parentCards, sortCards]
	);

	const displayRows = useMemo(() => {
		return sortedParents
			.filter((parent) => {
				if (!searchLower) return true;
				const subtasks = subtasksByParent[parent._id] || [];
				return (
					matchesQuery(parent) ||
					subtasks.some((subtask) => matchesQuery(subtask))
				);
			})
			.map((parent) => {
				const subtasks = subtasksByParent[parent._id] || [];
				const filteredSubtasks = searchLower
					? subtasks.filter((subtask) => matchesQuery(subtask))
					: subtasks;
				const sortedSubtasks = sortCards(filteredSubtasks);
				const completedCount = sortedSubtasks.filter(
					(subtask) => subtask.isCompleted
				).length;
				return {
					parent,
					subtasks: sortedSubtasks,
					completedCount,
				};
			});
	}, [sortedParents, subtasksByParent, searchLower, matchesQuery, sortCards]);

	const totalFilteredCount = useMemo(() => {
		if (!searchLower) return cardsWithListTitle.length;
		return cardsWithListTitle.filter((card) => matchesQuery(card)).length;
	}, [cardsWithListTitle, searchLower, matchesQuery]);

	// Handle sort
	const handleSort = (field: string) => {
		if (sortField === field) {
			setSortDirection(sortDirection === "asc" ? "desc" : "asc");
		} else {
			setSortField(field);
			setSortDirection("asc");
		}
	};

	const toggleExpanded = (parentId: string) => {
		setExpandedParents((prev) => ({
			...prev,
			[parentId]: !prev[parentId],
		}));
	};

	// Get priority icon
	const getPriorityIcon = (priority: string | undefined) => {
		switch (priority) {
			case "highest":
				return <AlertCircle className="w-3 h-3 text-destructive" />;
			case "high":
				return <AlertCircle className="w-3 h-3 text-orange-500" />;
			case "medium":
				return <ArrowRightCircle className="w-3 h-3 text-secondary" />;
			case "low":
				return <ArrowRightCircle className="w-3 h-3 text-blue-400" />;
			case "lowest":
				return <CheckCircle2 className="w-3 h-3 text-secondary/70" />;
			default:
				return null;
		}
	};

	return (
		<div className="flex flex-col h-full">
			{/* Table Search */}
			<div className="p-4 bg-white border-b">
				<div className="relative max-w-md">
					<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
					<Input
						className="pl-9"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search cards..."
						value={searchQuery}
					/>
				</div>
				<div className="mt-2 text-sm text-muted-foreground">
					Showing {totalFilteredCount} of {cardsWithListTitle.length} cards
				</div>
			</div>

			{/* Table */}
			<div
				className="w-full overflow-auto overflow-x-hidden flex-1 bg-white"
				style={{ WebkitOverflowScrolling: "touch" }}
			>
				<style jsx>{`
					::-webkit-scrollbar {
						width: 8px;
						height: 8px;
					}
					::-webkit-scrollbar-track {
						background: transparent;
					}
					::-webkit-scrollbar-thumb {
						background: #cbd5e1;
						border-radius: 4px;
					}
					::-webkit-scrollbar-thumb:hover {
						background: #94a3b8;
					}
				`}</style>
				<table className="w-full border-collapse">
					<thead className="sticky top-0 bg-muted z-10">
						<tr className="border-b">
							<th className="p-3 text-left font-medium text-sm">
								<button
									className="flex items-center gap-1 hover:text-secondary transition-colors"
									onClick={() => handleSort("title")}
									type="button"
								>
									Title
									{sortField === "title" && (
										<ArrowUpDown
											className={cn(
												"h-3 w-3 transition-transform",
												sortDirection === "desc" && "transform rotate-180"
											)}
										/>
									)}
								</button>
							</th>
							<th className="p-3 text-left font-medium text-sm">Description</th>
							<th className="p-3 text-left font-medium text-sm">
								<button
									className="flex items-center gap-1 hover:text-secondary transition-colors"
									onClick={() => handleSort("list")}
									type="button"
								>
									List
									{sortField === "list" && (
										<ArrowUpDown
											className={cn(
												"h-3 w-3 transition-transform",
												sortDirection === "desc" && "transform rotate-180"
											)}
										/>
									)}
								</button>
							</th>
							<th className="p-3 text-left font-medium text-sm">
								<button
									className="flex items-center gap-1 hover:text-secondary transition-colors"
									onClick={() => handleSort("priority")}
									type="button"
								>
									Priority
									{sortField === "priority" && (
										<ArrowUpDown
											className={cn(
												"h-3 w-3 transition-transform",
												sortDirection === "desc" && "transform rotate-180"
											)}
										/>
									)}
								</button>
							</th>
							<th className="p-3 text-left font-medium text-sm">Labels</th>
							<th className="p-3 text-left font-medium text-sm">Due Date</th>
							<th className="p-3 text-left font-medium text-sm">Assignees</th>
							<th className="p-3 text-left font-medium text-sm">Actions</th>
						</tr>
					</thead>
					<tbody>
						{displayRows.length === 0 ? (
							<tr>
								<td
									className="p-8 text-center text-muted-foreground"
									colSpan={8}
								>
									No cards found
								</td>
							</tr>
						) : (
							displayRows.map(({ parent, subtasks, completedCount }) => {
								const hasSubtasks = subtasks.length > 0;
								const isExpanded = expandedParents[parent._id] ?? !!searchLower;

								return (
									<React.Fragment key={parent._id}>
										<tr className="border-b hover:bg-muted/30 transition-colors">
											<td className="p-3 font-medium">
												<div className="flex items-center gap-2">
													{hasSubtasks ? (
														<Button
															onClick={() => toggleExpanded(parent._id)}
															size="iconSm"
															variant="ghost"
														>
															{isExpanded ? (
																<ChevronDown className="w-3.5 h-3.5" />
															) : (
																<ChevronRight className="w-3.5 h-3.5" />
															)}
														</Button>
													) : (
														<span className="w-6" />
													)}
													<span className="truncate">{parent.title}</span>
													{hasSubtasks && (
														<Badge className="text-[10px]" variant="secondary">
															{completedCount}/{subtasks.length}
														</Badge>
													)}
												</div>
											</td>
											<td className="p-3 text-sm text-muted-foreground max-w-[200px]">
												<div className="truncate">
													{parent.description || "-"}
												</div>
											</td>
											<td className="p-3">
												<Badge className="font-normal" variant="outline">
													{parent.listTitle}
												</Badge>
											</td>
											<td className="p-3">
												{parent.priority ? (
													<div className="flex items-center gap-1">
														{getPriorityIcon(parent.priority)}
														<Badge
															className={cn(
																"text-xs px-2 py-0.5",
																parent.priority === "high" &&
																	"bg-orange-500 hover:bg-orange-500/90",
																parent.priority === "low" &&
																	"border-blue-400 text-blue-400",
																parent.priority === "lowest" &&
																	"border-secondary/30 text-secondary/70"
															)}
															variant={
																parent.priority === "highest"
																	? "destructive"
																	: parent.priority === "high"
																		? "default"
																		: parent.priority === "medium"
																			? "secondary"
																			: parent.priority === "low"
																				? "outline"
																				: "outline"
															}
														>
															{parent.priority.charAt(0).toUpperCase() +
																parent.priority.slice(1)}
														</Badge>
													</div>
												) : (
													<span className="text-muted-foreground text-sm">
														-
													</span>
												)}
											</td>
											<td className="p-3">
												<div className="flex flex-wrap gap-1">
													{Array.isArray(parent.labels) &&
													parent.labels.length > 0 ? (
														parent.labels.map((label: string) => (
															<Badge
																className="text-xs px-2 py-0.5 bg-secondary/20"
																key={`${parent._id}-${label}`}
																variant="secondary"
															>
																{label}
															</Badge>
														))
													) : (
														<span className="text-muted-foreground text-sm">
															-
														</span>
													)}
												</div>
											</td>
											<td className="p-3 text-sm">
												{parent.dueDate ? (
													<div
														className={cn(
															"flex items-center gap-1",
															new Date(parent.dueDate) < new Date() &&
																"text-destructive"
														)}
													>
														<Clock className="w-3 h-3" />
														<span>
															{formatDistanceToNow(new Date(parent.dueDate), {
																addSuffix: true,
															})}
														</span>
													</div>
												) : (
													<span className="text-muted-foreground">-</span>
												)}
											</td>
											<td className="p-3">
												{parent.assignees && parent.assignees.length > 0 ? (
													<div className="flex -space-x-2">
														{parent.assignees
															.slice(0, 3)
															.map((assigneeId: Id<"members">) => {
																const assignee = memberDataMap[assigneeId];
																const fallback =
																	assignee?.name?.charAt(0).toUpperCase() ||
																	"?";

																return (
																	<TooltipProvider key={assigneeId}>
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<Avatar className="h-6 w-6 border border-background">
																					<AvatarImage
																						alt={assignee?.name}
																						src={assignee?.image}
																					/>
																					<AvatarFallback className="text-[10px]">
																						{fallback}
																					</AvatarFallback>
																				</Avatar>
																			</TooltipTrigger>
																			<TooltipContent>
																				<p>
																					{assignee?.name || "Unknown user"}
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	</TooltipProvider>
																);
															})}

														{parent.assignees.length > 3 && (
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Avatar className="h-6 w-6 border border-background bg-muted">
																			<AvatarFallback className="text-[10px]">
																				+{parent.assignees.length - 3}
																			</AvatarFallback>
																		</Avatar>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>
																			{parent.assignees.length - 3} more
																			assignees
																		</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														)}
													</div>
												) : (
													<span className="text-muted-foreground text-sm">
														-
													</span>
												)}
											</td>
											<td className="p-3">
												<div className="flex gap-1">
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	onClick={() => onEditCard(parent)}
																	size="iconSm"
																	variant="ghost"
																>
																	<Pencil className="w-3.5 h-3.5" />
																</Button>
															</TooltipTrigger>
															<TooltipContent>
																<p>Edit Card</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
													<TooltipProvider>
														<Tooltip>
															<TooltipTrigger asChild>
																<Button
																	onClick={() => onDeleteCard(parent._id)}
																	size="iconSm"
																	variant="ghost"
																>
																	<Trash className="w-3.5 h-3.5" />
																</Button>
															</TooltipTrigger>
															<TooltipContent>
																<p>Delete Card</p>
															</TooltipContent>
														</Tooltip>
													</TooltipProvider>
												</div>
											</td>
										</tr>

										{isExpanded &&
											subtasks.map((subtask) => (
												<tr
													className="border-b bg-muted/20 hover:bg-muted/30 transition-colors"
													key={subtask._id}
												>
													<td className="p-3 font-medium">
														<div className="flex items-center gap-2 pl-8">
															<span className="text-xs text-muted-foreground">
																Subtask
															</span>
															<span className="truncate">{subtask.title}</span>
														</div>
													</td>
													<td className="p-3 text-sm text-muted-foreground max-w-[200px]">
														<div className="truncate">
															{subtask.description || "-"}
														</div>
													</td>
													<td className="p-3">
														<Badge className="font-normal" variant="outline">
															{parent.listTitle}
														</Badge>
													</td>
													<td className="p-3">
														{subtask.priority ? (
															<div className="flex items-center gap-1">
																{getPriorityIcon(subtask.priority)}
																<Badge
																	className={cn(
																		"text-xs px-2 py-0.5",
																		subtask.priority === "high" &&
																			"bg-orange-500 hover:bg-orange-500/90",
																		subtask.priority === "low" &&
																			"border-blue-400 text-blue-400",
																		subtask.priority === "lowest" &&
																			"border-secondary/30 text-secondary/70"
																	)}
																	variant={
																		subtask.priority === "highest"
																			? "destructive"
																			: subtask.priority === "high"
																				? "default"
																				: subtask.priority === "medium"
																					? "secondary"
																					: subtask.priority === "low"
																						? "outline"
																						: "outline"
																	}
																>
																	{subtask.priority.charAt(0).toUpperCase() +
																		subtask.priority.slice(1)}
																</Badge>
															</div>
														) : (
															<span className="text-muted-foreground text-sm">
																-
															</span>
														)}
													</td>
													<td className="p-3">
														<div className="flex flex-wrap gap-1">
															{Array.isArray(subtask.labels) &&
															subtask.labels.length > 0 ? (
																subtask.labels.map((label: string) => (
																	<Badge
																		className="text-xs px-2 py-0.5 bg-secondary/20"
																		key={`${subtask._id}-${label}`}
																		variant="secondary"
																	>
																		{label}
																	</Badge>
																))
															) : (
																<span className="text-muted-foreground text-sm">
																	-
																</span>
															)}
														</div>
													</td>
													<td className="p-3 text-sm">
														{subtask.dueDate ? (
															<div
																className={cn(
																	"flex items-center gap-1",
																	new Date(subtask.dueDate) < new Date() &&
																		"text-destructive"
																)}
															>
																<Clock className="w-3 h-3" />
																<span>
																	{formatDistanceToNow(
																		new Date(subtask.dueDate),
																		{
																			addSuffix: true,
																		}
																	)}
																</span>
															</div>
														) : (
															<span className="text-muted-foreground">-</span>
														)}
													</td>
													<td className="p-3">
														{subtask.assignees &&
														subtask.assignees.length > 0 ? (
															<div className="flex -space-x-2">
																{subtask.assignees
																	.slice(0, 3)
																	.map((assigneeId: Id<"members">) => {
																		const assignee = memberDataMap[assigneeId];
																		const fallback =
																			assignee?.name?.charAt(0).toUpperCase() ||
																			"?";

																		return (
																			<TooltipProvider key={assigneeId}>
																				<Tooltip>
																					<TooltipTrigger asChild>
																						<Avatar className="h-6 w-6 border border-background">
																							<AvatarImage
																								alt={assignee?.name}
																								src={assignee?.image}
																							/>
																							<AvatarFallback className="text-[10px]">
																								{fallback}
																							</AvatarFallback>
																						</Avatar>
																					</TooltipTrigger>
																					<TooltipContent>
																						<p>
																							{assignee?.name || "Unknown user"}
																						</p>
																					</TooltipContent>
																				</Tooltip>
																			</TooltipProvider>
																		);
																	})}

																{subtask.assignees.length > 3 && (
																	<TooltipProvider>
																		<Tooltip>
																			<TooltipTrigger asChild>
																				<Avatar className="h-6 w-6 border border-background bg-muted">
																					<AvatarFallback className="text-[10px]">
																						+{subtask.assignees.length - 3}
																					</AvatarFallback>
																				</Avatar>
																			</TooltipTrigger>
																			<TooltipContent>
																				<p>
																					{subtask.assignees.length - 3} more
																					assignees
																				</p>
																			</TooltipContent>
																		</Tooltip>
																	</TooltipProvider>
																)}
															</div>
														) : (
															<span className="text-muted-foreground text-sm">
																-
															</span>
														)}
													</td>
													<td className="p-3">
														<div className="flex gap-1">
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			onClick={() => onEditCard(subtask)}
																			size="iconSm"
																			variant="ghost"
																		>
																			<Pencil className="w-3.5 h-3.5" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>Edit Card</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
															<TooltipProvider>
																<Tooltip>
																	<TooltipTrigger asChild>
																		<Button
																			onClick={() => onDeleteCard(subtask._id)}
																			size="iconSm"
																			variant="ghost"
																		>
																			<Trash className="w-3.5 h-3.5" />
																		</Button>
																	</TooltipTrigger>
																	<TooltipContent>
																		<p>Delete Card</p>
																	</TooltipContent>
																</Tooltip>
															</TooltipProvider>
														</div>
													</td>
												</tr>
											))}
									</React.Fragment>
								);
							})
						)}
					</tbody>
				</table>
			</div>
		</div>
	);
};

export default BoardTableView;
