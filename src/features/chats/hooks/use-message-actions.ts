"use client";

import { useCallback, useState } from "react";
import { toast } from "sonner";
import { useRemoveMessage } from "@/features/messages/api/use-remove-message";
import { useUpdateMessage } from "@/features/messages/api/use-update-message";
import { useToggleReaction } from "@/features/reactions/api/use-toggle-reaction";
import { useMessageSelection } from "@/features/smart/contexts/message-selection-context";
import { useCreateTaskFromMessage } from "@/features/tasks/api/use-create-task-from-message";
import { useConfirm } from "@/hooks/use-confirm";
import { usePanel } from "@/hooks/use-panel";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import type { Id } from "../../../../convex/_generated/dataModel";
import type { TaskModalState } from "../types/message";
import { extractTextFromBody } from "../utils/message-utils";

interface UseMessageActionsProps {
	messageId: Id<"messages">;
	body: string;
	authorName?: string;
	setEditingId: (id: Id<"messages"> | null) => void;
}

export const useMessageActions = ({
	messageId,
	body,
	authorName = "Member",
	setEditingId,
}: UseMessageActionsProps) => {
	const [ConfirmDialog, confirm] = useConfirm(
		"Delete message",
		"Are you sure you want to delete this message? This cannot be undone."
	);
	const { parentMessageId, onOpenMessage, onOpenProfile, onClose } = usePanel();
	const { isMessageSelected, toggleMessageSelection } = useMessageSelection();
	const workspaceId = useWorkspaceId();

	const { mutate: updateMessage, isPending: isUpdatingMessage } =
		useUpdateMessage();
	const { mutate: removeMessage, isPending: isRemovingMessage } =
		useRemoveMessage();
	const { mutate: toggleReaction, isPending: isTogglingReaction } =
		useToggleReaction();
	const createTaskFromMessage = useCreateTaskFromMessage();

	// Task modal state
	const [taskModal, setTaskModal] = useState<TaskModalState>({
		show: false,
		title: "",
		content: "",
		dueDate: "",
	});

	const isPending =
		isUpdatingMessage || isRemovingMessage || isTogglingReaction;
	const isSelected = isMessageSelected(messageId);

	const handleUpdate = useCallback(
		({ body }: { body: string }) => {
			updateMessage(
				{ id: messageId, body },
				{
					onSuccess: () => {
						toast.success("Message updated.");
						setEditingId(null);
					},
					onError: () => {
						toast.error("Failed to update message.");
					},
				}
			);
		},
		[messageId, updateMessage, setEditingId]
	);

	const handleDelete = useCallback(async () => {
		const ok = await confirm();

		if (!ok) return;

		removeMessage(
			{ id: messageId },
			{
				onSuccess: () => {
					toast.success("Message deleted.");

					if (parentMessageId === messageId) onClose();
				},
				onError: () => {
					toast.error("Failed to delete message.");
				},
			}
		);
	}, [messageId, removeMessage, confirm, parentMessageId, onClose]);

	const handleReaction = useCallback(
		async (value: string) => {
			toggleReaction(
				{ messageId, value },
				{
					onError: () => {
						toast.error("Failed to toggle reaction.");
					},
				}
			);
		},
		[messageId, toggleReaction]
	);

	const handleAddToTask = useCallback(() => {
		const messageText = extractTextFromBody(body);
		setTaskModal({
			show: true,
			title: `Task from ${authorName}`,
			content: messageText,
			dueDate: "",
		});
	}, [body, authorName]);

	const handleCreateTask = useCallback(async () => {
		if (!taskModal.title.trim()) {
			toast.error("Please enter a task title");
			return;
		}

		try {
			await createTaskFromMessage({
				messageId,
				workspaceId,
				title: taskModal.title,
				dueDate: taskModal.dueDate
					? new Date(taskModal.dueDate).getTime()
					: undefined,
				priority: "medium", // Default priority
			});

			toast.success("Task created successfully");
			setTaskModal({
				show: false,
				title: "",
				content: "",
				dueDate: "",
			});
		} catch (error) {
			console.error("Failed to create task:", error);
			toast.error("Failed to create task");
		}
	}, [taskModal, messageId, workspaceId, createTaskFromMessage]);

	const handleContextMenuAction = useCallback(
		(action: string) => {
			switch (action) {
				case "select":
					toggleMessageSelection(messageId);
					break;
				case "copy":
					navigator.clipboard.writeText(extractTextFromBody(body));
					toast.success("Message copied to clipboard");
					break;
				case "summarize":
					// The summarize functionality is handled by the SummarizeButton component
					// This action just triggers the summarize process for selected messages
					break;
				case "addToTask":
					handleAddToTask();
					break;
				case "edit":
					setEditingId(messageId);
					break;
				case "delete":
					handleDelete();
					break;
				case "reply":
					onOpenMessage(messageId);
					break;
				default:
				// Unknown action
			}
		},
		[
			messageId,
			body,
			toggleMessageSelection,
			handleAddToTask,
			setEditingId,
			handleDelete,
			onOpenMessage,
		]
	);

	return {
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
	};
};
