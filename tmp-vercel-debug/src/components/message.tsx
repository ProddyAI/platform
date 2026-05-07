"use client";

import { useEffect } from "react";
import { CompactMessage } from "@/features/chats/components/compact-message";
import { FullMessage } from "@/features/chats/components/full-message";
import { TaskCreationModal } from "@/features/chats/components/task-creation-modal";
import { useContextMenu } from "@/features/chats/contexts/context-menu-context";
import { useMessageActions } from "@/features/chats/hooks/use-message-actions";
import type { MessageProps } from "@/features/chats/types/message";

const MessageComponent = ({
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
	isCompact,
	threadCount,
	threadImage,
	threadName,
	threadTimestamp,
	calendarEvent,
}: MessageProps) => {
	const { closeContextMenu, contextMenu } = useContextMenu();

	const {
		ConfirmDialog,
		isPending,
		isSelected,
		taskModal,
		setTaskModal,
		handleUpdate,
		handleReaction,
		handleContextMenuAction,
		handleCreateTask,
		onOpenMessage,
		onOpenProfile,
	} = useMessageActions({
		messageId: id,
		body,
		authorName,
		setEditingId,
	});

	// Close context menu when clicking outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (contextMenu.show) {
				// Don't close if clicking on the context menu itself
				const target = e.target as Element;
				if (target?.closest(".context-menu")) {
					return;
				}
				closeContextMenu();
			}
		};

		if (contextMenu.show) {
			// Add a small delay to prevent immediate closing
			setTimeout(() => {
				document.addEventListener("click", handleClickOutside);
			}, 100);
			return () => document.removeEventListener("click", handleClickOutside);
		}
	}, [contextMenu.show, closeContextMenu]);

	const commonProps = {
		id,
		isAuthor,
		body,
		createdAt,
		image,
		isEditing,
		authorName,
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
		onUpdate: handleUpdate,
		onReaction: handleReaction,
		onOpenMessage,
		onContextMenuAction: handleContextMenuAction,
	};

	return (
		<>
			<ConfirmDialog />

			{isCompact ? (
				<CompactMessage {...commonProps} />
			) : (
				<FullMessage {...commonProps} onOpenProfile={onOpenProfile} />
			)}

			<TaskCreationModal
				isOpen={taskModal.show}
				onClose={() => setTaskModal({ ...taskModal, show: false })}
				onCreateTask={handleCreateTask}
				onTaskContentChange={(value) =>
					setTaskModal({ ...taskModal, content: value })
				}
				onTaskDueDateChange={(value) =>
					setTaskModal({ ...taskModal, dueDate: value })
				}
				onTaskTitleChange={(value) =>
					setTaskModal({ ...taskModal, title: value })
				}
				taskContent={taskModal.content}
				taskDueDate={taskModal.dueDate}
				taskTitle={taskModal.title}
			/>
		</>
	);
};

export const Message = (props: MessageProps) => {
	return <MessageComponent {...props} />;
};
