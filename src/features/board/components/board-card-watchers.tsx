"use client";

import { useMutation } from "convex/react";
import { Eye, EyeOff } from "lucide-react";
import type React from "react";
import { useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

interface BoardCardWatchersProps {
	cardId: Id<"cards">;
	watchers: Id<"members">[];
	currentMemberId?: Id<"members">;
	members: any[];
}

export const BoardCardWatchers: React.FC<BoardCardWatchersProps> = ({
	cardId,
	watchers,
	currentMemberId,
	members,
}) => {
	const [isOpen, setIsOpen] = useState(false);

	const addWatcher = useMutation(api.board.addWatcher);
	const removeWatcher = useMutation(api.board.removeWatcher);

	const isCurrentUserWatching =
		currentMemberId && watchers.includes(currentMemberId);

	const handleToggleWatcher = async (memberId: Id<"members">) => {
		try {
			if (watchers.includes(memberId)) {
				await removeWatcher({ cardId, memberId });
			} else {
				await addWatcher({ cardId, memberId });
			}
		} catch (error) {
			console.error("Failed to toggle watcher:", error);
		}
	};

	const watcherMembers = members.filter((m) => watchers.includes(m._id));

	return (
		<div className="flex items-center gap-2">
			{/* Watcher avatars */}
			{watcherMembers.length > 0 && (
				<div className="flex -space-x-2">
					{watcherMembers.slice(0, 3).map((member) => {
						const fallback = member.user?.name?.charAt(0).toUpperCase() || "?";

						return (
							<TooltipProvider key={member._id}>
								<Tooltip>
									<TooltipTrigger asChild>
										<Avatar className="h-6 w-6 border-2 border-background">
											<AvatarImage
												alt={member.user?.name}
												src={member.user?.image}
											/>
											<AvatarFallback className="text-xs">
												{fallback}
											</AvatarFallback>
										</Avatar>
									</TooltipTrigger>
									<TooltipContent>
										<p>{member.user?.name || "Unknown user"}</p>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						);
					})}
					{watcherMembers.length > 3 && (
						<TooltipProvider>
							<Tooltip>
								<TooltipTrigger asChild>
									<Avatar className="h-6 w-6 border-2 border-background bg-muted">
										<AvatarFallback className="text-xs">
											+{watcherMembers.length - 3}
										</AvatarFallback>
									</Avatar>
								</TooltipTrigger>
								<TooltipContent>
									<p>{watcherMembers.length - 3} more watchers</p>
								</TooltipContent>
							</Tooltip>
						</TooltipProvider>
					)}
				</div>
			)}

			{/* Watch/Unwatch button */}
			<Popover onOpenChange={setIsOpen} open={isOpen}>
				<PopoverTrigger asChild>
					<Button className="h-7 px-2" size="sm" variant="outline">
						{isCurrentUserWatching ? (
							<>
								<EyeOff className="w-3.5 h-3.5 mr-1" />
								Unwatch
							</>
						) : (
							<>
								<Eye className="w-3.5 h-3.5 mr-1" />
								Watch
							</>
						)}
					</Button>
				</PopoverTrigger>
				<PopoverContent align="start" className="w-64 p-3">
					<div className="space-y-2">
						<div className="flex items-center justify-between">
							<h4 className="text-sm font-semibold">Watchers</h4>
							<span className="text-xs text-muted-foreground">
								{watchers.length}
							</span>
						</div>
						<p className="text-xs text-muted-foreground">
							Watchers will be notified of all updates to this card.
						</p>

						<div className="space-y-1">
							{currentMemberId && (
								<Button
									className="w-full justify-start"
									onClick={() => handleToggleWatcher(currentMemberId)}
									size="sm"
									variant={isCurrentUserWatching ? "secondary" : "ghost"}
								>
									{isCurrentUserWatching ? (
										<EyeOff className="w-3.5 h-3.5 mr-2" />
									) : (
										<Eye className="w-3.5 h-3.5 mr-2" />
									)}
									{isCurrentUserWatching ? "Stop watching" : "Watch this card"}
								</Button>
							)}
						</div>

						{watcherMembers.length > 0 && (
							<div className="pt-2 border-t space-y-1">
								<h5 className="text-xs font-medium">Current watchers</h5>
								{watcherMembers.map((member) => (
									<div
										className="flex items-center justify-between p-1.5 rounded-md hover:bg-accent"
										key={member._id}
									>
										<div className="flex items-center gap-2">
											<Avatar className="h-5 w-5">
												<AvatarImage
													alt={member.user?.name}
													src={member.user?.image}
												/>
												<AvatarFallback className="text-[9px]">
													{member.user?.name?.charAt(0).toUpperCase() || "?"}
												</AvatarFallback>
											</Avatar>
											<span className="text-xs">{member.user?.name}</span>
										</div>
										{currentMemberId === member._id && (
											<Button
												onClick={() => handleToggleWatcher(member._id)}
												size="iconSm"
												variant="ghost"
											>
												<EyeOff className="w-3 h-3" />
											</Button>
										)}
									</div>
								))}
							</div>
						)}
					</div>
				</PopoverContent>
			</Popover>
		</div>
	);
};
