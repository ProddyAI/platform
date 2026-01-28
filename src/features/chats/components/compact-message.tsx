"use client";

import { format } from "date-fns";
import { Hint } from "@/components/hint";
import { cn } from "@/lib/utils";
import { useContextMenu } from "../contexts/context-menu-context";
import type { MessageProps } from "../types/message";
import { formatFullTime } from "../utils/message-utils";
import { MessageContent } from "./message-content";
import { MessageContextMenu } from "./message-context-menu";

interface CompactMessageProps extends MessageProps {
	isPending: boolean;
	isSelected: boolean;
	onUpdate: ({ body }: { body: string }) => void;
	onReaction: (value: string) => void;
	onOpenMessage: (id: any) => void;
	onContextMenuAction: (action: string) => void;
}

export const CompactMessage = ({
	id,
	isAuthor,
	body,
	createdAt,
	image,
	isEditing,
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
	onContextMenuAction,
}: CompactMessageProps) => {
	const { openContextMenu } = useContextMenu();

	const handleContextMenu = (e: React.MouseEvent) => {
		e.preventDefault();
		e.stopPropagation();
		openContextMenu(e.clientX, e.clientY, id);
	};

	return (
		<>
			<div
				className={cn(
					"group relative flex items-start gap-3 p-3 hover:bg-gray-100/60 dark:hover:bg-slate-700/50 transition-standard hover:shadow-sm rounded-[10px]",
					isEditing && "bg-secondary/20 hover:bg-secondary/20",
					isPending &&
						"origin-bottom scale-y-0 transform bg-rose-500/50 transition-standard",
					isSelected && "bg-secondary/10 hover:bg-secondary/10",
					isAuthor && "flex-row-reverse"
				)}
				onContextMenu={handleContextMenu}
			>
				{/* Timestamp */}
				<div className="flex items-center gap-2 min-w-[50px]">
					{isAuthor ? (
						// For self messages, show timestamp on the right (due to flex-row-reverse)
						<Hint label={formatFullTime(new Date(createdAt))}>
							<button className="text-center text-sm leading-[22px] text-muted-foreground opacity-0 hover:underline group-hover:opacity-100">
								{format(new Date(createdAt), "h:mm a")}
							</button>
						</Hint>
					) : (
						// For other messages, show timestamp on the left
						<Hint label={formatFullTime(new Date(createdAt))}>
							<button className="text-center text-sm leading-[22px] text-muted-foreground opacity-0 hover:underline group-hover:opacity-100">
								{format(new Date(createdAt), "h:mm a")}
							</button>
						</Hint>
					)}
				</div>

				{/* Message Content */}
				<div
					className={cn(
						"flex-1 min-w-0",
						isAuthor && "flex flex-col items-end"
					)}
				>
					<MessageContent
						id={id}
						body={body}
						image={image}
						isEditing={isEditing}
						isAuthor={isAuthor}
						updatedAt={updatedAt}
						calendarEvent={calendarEvent}
						reactions={reactions}
						threadCount={threadCount}
						threadImage={threadImage}
						threadName={threadName}
						threadTimestamp={threadTimestamp}
						isPending={isPending}
						onUpdate={onUpdate}
						onCancel={() => setEditingId(null)}
						onReaction={onReaction}
						onOpenMessage={onOpenMessage}
						onContextMenu={handleContextMenu}
					/>
				</div>
			</div>

			<MessageContextMenu
				messageId={id}
				isAuthor={isAuthor}
				isSelected={isSelected}
				hideThreadButton={hideThreadButton}
				onAction={onContextMenuAction}
			/>
		</>
	);
};
