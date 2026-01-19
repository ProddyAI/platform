"use client";

import { formatDistanceToNow } from "date-fns";
import { Clock, KanbanSquare, Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetAssignedCards } from "@/features/board/api/use-get-assigned-cards";
import { useGetChannels } from "@/features/channels/api/use-get-channels";
import { WidgetCard } from "../shared/widget-card";

interface AssignedCardsWidgetProps {
	workspaceId: Id<"workspaces">;
	member: {
		_id: Id<"members">;
		userId: Id<"users">;
		role: string;
		workspaceId: Id<"workspaces">;
		user?: {
			name: string;
			image?: string;
		};
	};
	isEditMode?: boolean;
	controls?: React.ReactNode;
}

export const AssignedCardsWidget = ({
	workspaceId,
	isEditMode,
	controls,
}: AssignedCardsWidgetProps) => {
	const router = useRouter();

	// Fetch channels for the workspace
	const { data: channels } = useGetChannels({ workspaceId });

	// Fetch board items assigned to the current user
	const { data: assignedCards, isLoading: cardsLoading } = useGetAssignedCards({
		workspaceId,
	});

	// Sort board cards by due date and creation time
	const sortedCards = assignedCards
		? [...assignedCards]
				.sort((a, b) => {
					// Sort by due date if available
					if (a.dueDate && b.dueDate) {
						return a.dueDate - b.dueDate;
					}

					// If only one has a due date, prioritize it
					if (a.dueDate) return -1;
					if (b.dueDate) return 1;

					// Finally sort by creation time
					return b._creationTime - a._creationTime;
				})
				.slice(0, 10)
		: []; // Limit to 10 cards for the widget

	// Handle viewing a board card
	const handleViewCard = (card: any) => {
		const channelId = card.channelId;
		router.push(
			`/workspace/${workspaceId}/channel/${channelId}/board?cardId=${card._id}`
		);
	};

	if (cardsLoading) {
		return (
			<div className="flex h-[300px] items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2">
					<KanbanSquare className="h-5 w-5 text-primary dark:text-purple-400" />
					<h3 className="font-semibold text-base">Assigned Cards</h3>
					{!isEditMode && sortedCards.length > 0 && (
						<Badge
							variant="secondary"
							className="ml-1 h-5 px-2 text-xs font-medium"
						>
							{sortedCards.length}
						</Badge>
					)}
				</div>
				{isEditMode
					? controls
					: channels &&
						channels.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								className="h-8 text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
								onClick={() =>
									router.push(
										`/workspace/${workspaceId}/channel/${channels[0]._id}/board`
									)
								}
							>
								View all
							</Button>
						)}
			</div>

			{sortedCards.length > 0 ? (
				<ScrollArea className="h-[280px]">
					<div className="space-y-2 pr-4">
						{sortedCards.map((card) => (
							<WidgetCard key={card._id}>
								<div className="space-y-2">
									<div className="flex items-start justify-between gap-2">
										<p className="font-medium text-sm leading-tight flex-1">
											{card.title}
										</p>
										{card.dueDate && (
											<span className="text-[10px] text-red-600 dark:text-red-400 font-medium whitespace-nowrap flex items-center gap-0.5">
												<Clock className="h-2.5 w-2.5" />
												{formatDistanceToNow(new Date(card.dueDate), {
													addSuffix: true,
												}).replace("about ", "")}
											</span>
										)}
									</div>
									<div className="flex items-center gap-2">
										<Badge
											variant="outline"
											className="text-xs h-5 px-2 border-purple-200 text-purple-700 dark:border-purple-800 dark:text-purple-300"
										>
											# {card.channelName || "Unknown Channel"}
										</Badge>
									</div>
									<Button
										variant="ghost"
										size="sm"
										className="h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:text-primary/90 hover:bg-primary/10 dark:text-purple-400 dark:hover:text-purple-300 dark:hover:bg-purple-950"
										onClick={() => handleViewCard(card)}
									>
										View
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<div className="flex h-[250px] flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/5">
					<KanbanSquare className="mb-3 h-12 w-12 text-muted-foreground/40" />
					<h3 className="text-base font-semibold text-foreground">
						No assigned cards
					</h3>
					<p className="text-sm text-muted-foreground mt-1">
						You don't have any board cards assigned
					</p>
					{channels && channels.length > 0 && (
						<Button
							variant="default"
							size="sm"
							className="mt-4 bg-primary hover:bg-primary/90 text-primary-foreground dark:bg-purple-600 dark:hover:bg-purple-700"
							onClick={() =>
								router.push(
									`/workspace/${workspaceId}/channel/${channels[0]._id}/board`
								)
							}
						>
							View boards
						</Button>
					)}
				</div>
			)}
		</div>
	);
};
