"use client";

import { useMutation, useQuery } from "convex/react";
import { AlertTriangle, Plus, X } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";

interface BoardCardBlockingRelationshipsProps {
	cardId: Id<"cards">;
	channelId: Id<"channels">;
}

export const BoardCardBlockingRelationships: React.FC<
	BoardCardBlockingRelationshipsProps
> = ({ cardId, channelId }) => {
	const [isOpen, setIsOpen] = useState(false);
	const [searchQuery, setSearchQuery] = useState("");

	const blockingCards = useQuery(
		api.board.getBlockingCards,
		cardId ? { cardId } : "skip"
	);
	const allCards = useQuery(api.board.getAllCardsForChannel, { channelId });

	const addBlockingRelationship = useMutation(
		api.board.addBlockingRelationship
	);
	const removeBlockingRelationship = useMutation(
		api.board.removeBlockingRelationship
	);

	const handleAddBlocker = async (blockedByCardId: Id<"cards">) => {
		try {
			await addBlockingRelationship({ cardId, blockedByCardId });
			setSearchQuery("");
			setIsOpen(false);
		} catch (error) {
			console.error("Failed to add blocking relationship:", error);
		}
	};

	const handleRemoveBlocker = async (blockedByCardId: Id<"cards">) => {
		try {
			await removeBlockingRelationship({ cardId, blockedByCardId });
		} catch (error) {
			console.error("Failed to remove blocking relationship:", error);
		}
	};

	// Filter cards for search
	const filteredCards =
		allCards?.filter(
			(card) =>
				card._id !== cardId &&
				!blockingCards?.find((bc) => bc._id === card._id) &&
				card.title.toLowerCase().includes(searchQuery.toLowerCase())
		) || [];

	const hasBlockingCards = blockingCards && blockingCards.length > 0;

	return (
		<div className="space-y-2">
			{/* Blocking cards display */}
			{hasBlockingCards && (
				<div className="rounded-md border border-orange-200 bg-orange-50 dark:bg-orange-950/30 dark:border-orange-900 p-3 space-y-2">
					<div className="flex items-center gap-2">
						<AlertTriangle className="w-4 h-4 text-orange-600 dark:text-orange-400" />
						<h4 className="text-sm font-semibold text-orange-900 dark:text-orange-200">
							Blocked By
						</h4>
					</div>
					<div className="space-y-1">
						{blockingCards.map((blocker) => (
							<div
								className="flex items-center justify-between p-2 rounded-md bg-background border"
								key={blocker._id}
							>
								<div className="flex-1 min-w-0">
									<p className="text-sm font-medium truncate">
										{blocker.title}
									</p>
									{blocker.listTitle && (
										<p className="text-xs text-muted-foreground">
											{blocker.listTitle}
										</p>
									)}
								</div>
								<Button
									onClick={() => handleRemoveBlocker(blocker._id)}
									size="iconSm"
									variant="ghost"
								>
									<X className="w-3.5 h-3.5" />
								</Button>
							</div>
						))}
					</div>
				</div>
			)}

			{/* Add blocker button */}
			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger asChild>
					<Button className="w-full" size="sm" variant="outline">
						<Plus className="w-3.5 h-3.5 mr-1" />
						{hasBlockingCards ? "Add Another Blocker" : "Add Blocking Card"}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-80 p-3">
					<div className="space-y-3">
						<div>
							<h4 className="text-sm font-semibold mb-1">
								Add Blocking Relationship
							</h4>
							<p className="text-xs text-muted-foreground">
								Select a card that blocks this one from being completed.
							</p>
						</div>

						<Input
							autoFocus
							className="h-8 text-sm"
							onChange={(e) => setSearchQuery(e.target.value)}
							placeholder="Search cards..."
							value={searchQuery}
						/>

						<ScrollArea className="h-[200px]">
							{filteredCards.length > 0 ? (
								<div className="space-y-1">
									{filteredCards.map((card) => (
										<Button
											className="w-full justify-start h-auto py-2 px-2"
											key={card._id}
											onClick={() => handleAddBlocker(card._id)}
											variant="ghost"
										>
											<div className="flex-1 text-left">
												<p className="text-sm font-medium">{card.title}</p>
												{card.priority && (
													<Badge
														className="text-[10px] h-4 mt-1"
														variant="secondary"
													>
														{card.priority}
													</Badge>
												)}
											</div>
										</Button>
									))}
								</div>
							) : (
								<div className="flex items-center justify-center h-full text-sm text-muted-foreground">
									{searchQuery ? "No cards found" : "Start typing to search..."}
								</div>
							)}
						</ScrollArea>
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};
