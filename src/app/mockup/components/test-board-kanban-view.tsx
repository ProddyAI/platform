"use client";
"use client";

import { format } from "date-fns";
import {
	AlertTriangle,
	ArrowRight,
	Calendar,
	FileText,
	MoreHorizontal,
	Plus,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface BoardList {
	_id: string;
	title: string;
	position: number;
	_creationTime: number;
}

export interface BoardCard {
	_id: string;
	title: string;
	description?: string;
	labels?: string[];
	priority: "highest" | "high" | "medium" | "low";
	dueDate?: Date;
	assignees?: string[];
	listId: string;
	position: number;
	_creationTime: number;
}

export interface BoardMember {
	_id: string;
	user: {
		name: string;
		image?: string | null;
	};
}

interface TestBoardKanbanViewProps {
	lists: BoardList[];
	cardsByList: Record<string, BoardCard[]>;
	members: BoardMember[];
	onEditCard: (card: BoardCard) => void;
	onDeleteCard: (cardId: string) => void;
	onAddCard: (listId: string) => void;
	onMoveCard: (cardId: string) => void;
	handleDragEnd: (event: any) => void;
}

export const TestBoardKanbanView = ({
	lists,
	cardsByList,
	members,
	onEditCard,
	onDeleteCard,
	onAddCard,
	onMoveCard,
	handleDragEnd,
}: TestBoardKanbanViewProps) => {
	const router = useRouter();

	const handleViewNotes = () => {
		router.push("/mockup/notes");
	};

	const getPriorityColor = (priority: BoardCard["priority"]) => {
		switch (priority) {
			case "highest":
				return "border-l-4 border-red-600 bg-red-50";
			case "high":
				return "border-l-4 border-orange-500 bg-orange-50";
			case "medium":
				return "border-l-4 border-yellow-500 bg-yellow-50";
			case "low":
				return "border-l-4 border-green-500 bg-green-50";
			default:
				return "border-l-4 border-gray-400 bg-gray-50";
		}
	};

	const getPriorityBadgeVariant = (
		priority: BoardCard["priority"]
	): "destructive" | "default" | "secondary" | "outline" => {
		switch (priority) {
			case "highest":
				return "destructive";
			case "high":
				return "default";
			case "medium":
				return "secondary";
			case "low":
				return "outline";
			default:
				return "outline";
		}
	};

	const getMemberName = (memberId: string) => {
		const member = members.find((m) => m._id === memberId);
		return member?.user?.name || "Unknown";
	};

	const getMemberInitials = (memberId: string) => {
		const name = getMemberName(memberId);
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	const isOverdue = (dueDate: Date) => {
		return dueDate < new Date();
	};

	const isDueSoon = (dueDate: Date) => {
		const tomorrow = new Date();
		tomorrow.setDate(tomorrow.getDate() + 1);
		return dueDate <= tomorrow && dueDate >= new Date();
	};

	return (
		<div className="flex h-full overflow-x-auto p-4 gap-4">
			{lists.map((list) => (
				<div className="flex-shrink-0 w-80" key={list._id}>
					<Card className="h-full flex flex-col">
						<CardHeader className="pb-3">
							<div className="flex items-center justify-between">
								<CardTitle className="text-lg flex items-center gap-2">
									{list.title}
									<Badge className="text-xs" variant="secondary">
										{cardsByList[list._id]?.length || 0}
									</Badge>
								</CardTitle>
								<Button
									onClick={() => onAddCard(list._id)}
									size="sm"
									variant="ghost"
								>
									<Plus className="h-4 w-4" />
								</Button>
							</div>
						</CardHeader>
						<CardContent className="flex-1 overflow-hidden p-0">
							<ScrollArea className="h-full px-4 pb-4">
								<div className="space-y-3">
									{cardsByList[list._id]?.length === 0 ? (
										<div className="text-center py-8 text-muted-foreground">
											<div className="text-sm">No cards in this list</div>
											<div className="text-xs mt-1">
												Add a card to get started
											</div>
										</div>
									) : (
										cardsByList[list._id]?.map((card) => (
											<Card
												className={`cursor-pointer transition-all hover:shadow-md ${getPriorityColor(card.priority)}`}
												key={card._id}
												onClick={() => onEditCard(card)}
											>
												<CardContent className="p-4">
													{/* Card Header */}
													<div className="flex items-start justify-between mb-3">
														<h3 className="font-medium text-sm leading-tight">
															{card.title}
														</h3>
														<DropdownMenu>
															<DropdownMenuTrigger asChild>
																<Button
																	className="h-6 w-6 p-0"
																	onClick={(e) => e.stopPropagation()}
																	size="sm"
																	variant="ghost"
																>
																	<MoreHorizontal className="h-4 w-4" />
																</Button>
															</DropdownMenuTrigger>
															<DropdownMenuContent align="end">
																<DropdownMenuItem
																	onClick={() => onEditCard(card)}
																>
																	Edit Card
																</DropdownMenuItem>
																<DropdownMenuItem onClick={handleViewNotes}>
																	<FileText className="h-4 w-4 mr-2" />
																	View Notes
																</DropdownMenuItem>
																<DropdownMenuItem
																	onClick={() => onMoveCard(card._id)}
																>
																	<ArrowRight className="h-4 w-4 mr-2" />
																	Move to Next List
																</DropdownMenuItem>
																<DropdownMenuSeparator />
																<DropdownMenuItem
																	className="text-destructive"
																	onClick={() => onDeleteCard(card._id)}
																>
																	Delete Card
																</DropdownMenuItem>
															</DropdownMenuContent>
														</DropdownMenu>
													</div>

													{/* Card Description */}
													{card.description && (
														<p className="text-xs text-muted-foreground mb-3 line-clamp-2">
															{card.description}
														</p>
													)}

													{/* Labels */}
													{card.labels && card.labels.length > 0 && (
														<div className="flex flex-wrap gap-1 mb-3">
															{card.labels.slice(0, 3).map((label: string) => (
																<Badge
																	className="text-xs"
																	key={label}
																	variant="outline"
																>
																	{label}
																</Badge>
															))}
															{card.labels.length > 3 && (
																<Badge className="text-xs" variant="outline">
																	+{card.labels.length - 3}
																</Badge>
															)}
														</div>
													)}

													{/* Due Date */}
													{card.dueDate && (
														<div className="flex items-center gap-1 mb-3">
															<Calendar className="h-3 w-3" />
															<span
																className={`text-xs ${
																	isOverdue(card.dueDate)
																		? "text-red-600 font-medium"
																		: isDueSoon(card.dueDate)
																			? "text-orange-600 font-medium"
																			: "text-muted-foreground"
																}`}
															>
																{format(card.dueDate, "MMM d")}
																{isOverdue(card.dueDate) && " (Overdue)"}
																{isDueSoon(card.dueDate) &&
																	!isOverdue(card.dueDate) &&
																	" (Due Soon)"}
															</span>
														</div>
													)}

													{/* Priority and Assignees */}
													<div className="flex items-center justify-between">
														<Badge
															className="text-xs capitalize"
															variant={getPriorityBadgeVariant(card.priority)}
														>
															{card.priority === "highest" && (
																<AlertTriangle className="h-3 w-3 mr-1" />
															)}
															{card.priority}
														</Badge>

														{card.assignees && card.assignees.length > 0 && (
															<div className="flex -space-x-1">
																{card.assignees
																	.slice(0, 3)
																	.map((assigneeId: string) => (
																		<Avatar
																			className="h-6 w-6 border-2 border-white"
																			key={assigneeId}
																		>
																			<AvatarFallback className="text-xs">
																				{getMemberInitials(assigneeId)}
																			</AvatarFallback>
																		</Avatar>
																	))}
																{card.assignees.length > 3 && (
																	<div className="h-6 w-6 rounded-full bg-gray-200 border-2 border-white flex items-center justify-center">
																		<span className="text-xs text-gray-600">
																			+{card.assignees.length - 3}
																		</span>
																	</div>
																)}
															</div>
														)}
													</div>
												</CardContent>
											</Card>
										))
									)}

									{/* Add Card Button */}
									<Button
										className="w-full justify-start text-muted-foreground hover:text-foreground"
										onClick={() => onAddCard(list._id)}
										variant="ghost"
									>
										<Plus className="h-4 w-4 mr-2" />
										Add a card
									</Button>
								</div>
							</ScrollArea>
						</CardContent>
					</Card>
				</div>
			))}
		</div>
	);
};
