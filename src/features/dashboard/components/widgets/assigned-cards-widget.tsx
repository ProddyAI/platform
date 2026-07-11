"use client";

import { KanbanSquare } from "lucide-react";
import { useRouter } from "next/navigation";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useGetAssignedCards } from "@/features/board/api/use-get-assigned-cards";
import { RelativeTime } from "../shared/relative-time";
import { WidgetCard } from "../shared/widget-card";
import { WidgetEmptyState } from "../shared/widget-empty-state";
import { WidgetHeader } from "../shared/widget-header";
import { WidgetLoading } from "../shared/widget-loading";

// A due date is only overdue once its calendar day has fully elapsed, matching
// the convention in board-issue-row.tsx's isOverdue check.
function isOverdue(dueDate: number): boolean {
	const dueDateEndOfDay = new Date(dueDate);
	dueDateEndOfDay.setHours(23, 59, 59, 999);
	return dueDateEndOfDay < new Date();
}

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
	const handleViewCard = (card: (typeof sortedCards)[number]) => {
		const channelId = card.channelId;
		router.push(
			`/workspace/${workspaceId}/channel/${channelId}/board?cardId=${card._id}`
		);
	};

	if (cardsLoading) {
		return <WidgetLoading />;
	}

	return (
		<div className="space-y-3">
			<WidgetHeader
				action={
					sortedCards.length > 0 && (
						<Button
							className="h-8 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
							onClick={() => router.push(`/workspace/${workspaceId}/tasks`)}
							size="sm"
							variant="ghost"
						>
							View All
						</Button>
					)
				}
				badge={sortedCards.length > 0 ? sortedCards.length : undefined}
				controls={controls}
				icon={<KanbanSquare className="size-5 text-primary" />}
				isEditMode={isEditMode}
				title="Assigned Issues"
			/>

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
											<RelativeTime
												className="text-[10px]"
												iconClassName="size-2.5"
												overdue={isOverdue(card.dueDate)}
												timestamp={card.dueDate}
											/>
										)}
									</div>
									<div className="flex items-center gap-2">
										<Badge className="h-5 px-2 text-xs" variant="outline">
											# {card.channelName || "Unknown Channel"}
										</Badge>
									</div>
									<Button
										className="h-7 px-2 w-full justify-center text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary"
										onClick={() => handleViewCard(card)}
										size="sm"
										variant="ghost"
									>
										View
									</Button>
								</div>
							</WidgetCard>
						))}
					</div>
				</ScrollArea>
			) : (
				<WidgetEmptyState
					description="You don't have any issues assigned right now"
					icon={KanbanSquare}
					title="No assigned issues"
				/>
			)}
		</div>
	);
};
