"use client";

import { format } from "date-fns";
import { Hint } from "@/components/hint";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useContextMenu } from "@/contexts/context-menu-context";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { MessageProps } from "../types";
import { formatFullTime } from "../utils/message-utils";
import { MessageContent } from "./message-content";
import { MessageContextMenu } from "./message-context-menu";

interface FullMessageProps extends MessageProps {
	isPending: boolean;
	isSelected: boolean;
	onUpdate: ({ body }: { body: string }) => void;
	onReaction: (value: string) => void;
	onOpenMessage: (id: Id<"messages">) => void;
	onOpenProfile: (id: Id<"members">) => void;
	onContextMenuAction: (action: string) => void;
}

export const FullMessage = ({
	id,
	isAuthor,
	body,
	createdAt,
	image,
	isEditing,
	authorName = "Member",
	authorImage,
	memberId,
	reactions,
	setEditingId,
	updatedAt,
	hideThreadButton,
	threadCount,
	threadImage,
	threadName,
	threadTimestamp,
	calendarEvent,
	isPending,
	isSelected,
	onUpdate,
	onReaction,
	onOpenMessage,
	onOpenProfile,
	onContextMenuAction,
}: FullMessageProps) => {
	const { openContextMenu } = useContextMenu();
	const avatarFallback = authorName.charAt(0).toUpperCase();

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		openContextMenu(e.clientX, e.clientY, id);
	};

	return (
		<>
			<div
				className={cn(
					"group relative flex items-start gap-2 md:gap-3 p-2 md:p-3 hover:bg-muted/60 transition-standard hover:shadow-sm rounded-[10px]",
					isEditing && "bg-secondary/20 hover:bg-secondary/20",
					isPending && "opacity-60 motion-reduce:transition-none",
					isSelected && "bg-secondary/10 hover:bg-secondary/10",
					isAuthor && "flex-row-reverse"
				)}
				onContextMenu={handleContextMenu}
				role="group"
			>
				{/* Avatar */}
				<div className="flex-shrink-0">
					<button
						aria-label={`View ${authorName} profile`}
						onClick={() => onOpenProfile(memberId)}
						type="button"
					>
						<Avatar className="h-8 w-8 md:h-10 md:w-10">
							<AvatarImage alt={authorName} src={authorImage} />
							<AvatarFallback>{avatarFallback}</AvatarFallback>
						</Avatar>
					</button>
				</div>

				{/* Message Content */}
				<div
					className={cn(
						"flex-1 min-w-0",
						isAuthor && "flex flex-col items-end"
					)}
				>
					{/* Author and timestamp */}
					<div
						className={cn(
							"flex items-baseline gap-2 mb-1",
							isAuthor && "flex-row-reverse"
						)}
					>
						<button
							className="font-medium text-sm hover:underline transition-all duration-200"
							onClick={() => onOpenProfile(memberId)}
							type="button"
						>
							{authorName}
						</button>
						<Hint label={formatFullTime(new Date(createdAt))}>
							<button
								className="text-xs text-muted-foreground hover:underline transition-all duration-200"
								type="button"
							>
								{format(new Date(createdAt), "h:mm a")}
							</button>
						</Hint>
					</div>

					<MessageContent
						body={body}
						calendarEvent={calendarEvent}
						id={id}
						image={image}
						isAuthor={isAuthor}
						isEditing={isEditing}
						isPending={isPending}
						onCancel={() => setEditingId(null)}
						onContextMenu={handleContextMenu}
						onOpenMessage={onOpenMessage}
						onReaction={onReaction}
						onUpdate={onUpdate}
						reactions={reactions}
						threadCount={threadCount}
						threadImage={threadImage}
						threadName={threadName}
						threadTimestamp={threadTimestamp}
						updatedAt={updatedAt}
					/>
				</div>
			</div>

			<MessageContextMenu
				hideThreadButton={hideThreadButton}
				isAuthor={isAuthor}
				isSelected={isSelected}
				messageId={id}
				onAction={onContextMenuAction}
			/>
		</>
	);
};
