"use client";

import { format } from "date-fns";
import { memo, useCallback } from "react";
import { Hint } from "@/components/hint";
import { useContextMenu } from "@/contexts/context-menu-context";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { MessageProps } from "../types";
import { formatFullTime } from "../utils/message-utils";
import { MessageContent } from "./message-content";
import { MessageContextMenu } from "./message-context-menu";

interface CompactMessageProps extends MessageProps {
	isPending: boolean;
	isSelected: boolean;
	onUpdate: ({ body }: { body: string }) => void;
	onReaction: (value: string) => void;
	onOpenMessage: (id: Id<"messages">) => void;
	onContextMenuAction: (action: string) => void;
}

const CompactMessageComponent = ({
	id,
	isAuthor,
	body,
	createdAt,
	image,
	isEditing,
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
	onContextMenuAction,
}: CompactMessageProps) => {
	const { openContextMenu } = useContextMenu();

	const handleContextMenu = useCallback(
		(e: React.MouseEvent) => {
			e.preventDefault();
			e.stopPropagation();
			openContextMenu(e.clientX, e.clientY, id);
		},
		[openContextMenu, id]
	);

	return (
		<>
			<div
				className={cn(
					"group relative flex items-start gap-2 md:gap-3 p-2 md:p-3 hover:bg-muted/60 transition-standard hover:shadow-sm rounded-lg motion-reduce:transition-none",
					isEditing && "bg-primary/10 hover:bg-primary/10",
					isPending && "opacity-60 transition-standard",
					isSelected && "bg-primary/5 hover:bg-primary/5",
					isAuthor && "flex-row-reverse"
				)}
				onContextMenu={handleContextMenu}
			>
				{/* Timestamp (position mirrors via flex-row-reverse when isAuthor) */}
				<div className="flex items-center gap-2 min-w-[40px] md:min-w-[50px]">
					<Hint label={formatFullTime(new Date(createdAt))}>
						<time
							className="text-center text-xs md:text-sm leading-[22px] text-muted-foreground opacity-0 transition-opacity duration-fast group-hover:opacity-100 motion-reduce:transition-none"
							dateTime={new Date(createdAt).toISOString()}
						>
							{format(new Date(createdAt), "h:mm a")}
						</time>
					</Hint>
				</div>

				{/* Message Content */}
				<div
					className={cn(
						"flex-1 min-w-0",
						isAuthor && "flex flex-col items-end"
					)}
				>
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

export const CompactMessage = memo(CompactMessageComponent);
