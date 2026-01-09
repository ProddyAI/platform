import {
	CheckSquare,
	ListTodo,
	MessageSquareText,
	Pencil,
	Smile,
	Trash,
} from "lucide-react";
import { useEffect, useState } from "react";
import type { Id } from "@/../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { useGetMessage } from "@/features/messages/api/use-get-message";
import { useMessageSelection } from "@/features/smart/contexts/message-selection-context";
import { AddMessageToTaskModal } from "@/features/tasks/components/add-message-to-task-modal";

import { EmojiPopover } from "./emoji-popover";
import { Hint } from "./hint";

interface ToolbarProps {
	isAuthor: boolean;
	isPending: boolean;
	handleEdit: () => void;
	handleDelete: () => void;
	handleThread: () => void;
	handleReaction: (value: string) => void;
	hideThreadButton?: boolean;
	messageId: string; // Added messageId prop for selection
	workspaceId: Id<"workspaces">;
	messageContent: string;
}

export const Toolbar = ({
	isAuthor,
	isPending,
	handleEdit,
	handleDelete,
	handleThread,
	handleReaction,
	hideThreadButton,
	messageId,
	workspaceId,
	messageContent,
}: ToolbarProps) => {
	const [isAddToTaskModalOpen, setIsAddToTaskModalOpen] = useState(false);
	const [extractedContent, setExtractedContent] = useState(messageContent);
	const { isMessageSelected, toggleMessageSelection } = useMessageSelection();
	const isSelected = isMessageSelected(messageId as any); // Type cast needed because of Id<'messages'>

	// Fetch the message directly to get its content
	const { data: messageData } = useGetMessage({
		id: messageId as Id<"messages">,
	});

	useEffect(() => {
		if (messageData?.body) {
			try {
				// Try to parse the body
				const parsedBody = JSON.parse(messageData.body);

				// If it's a string, use it directly
				if (typeof parsedBody === "string") {
					setExtractedContent(parsedBody);
				}
				// If it's a Quill delta format
				else if (Array.isArray(parsedBody) && parsedBody.length > 0) {
					// Extract text from operations
					const text = parsedBody
						.map((op) => (typeof op.insert === "string" ? op.insert : ""))
						.join("")
						.trim();

					setExtractedContent(text || messageContent);
				}
			} catch (error) {
				console.error("Failed to parse message body:", error);
				// Fallback to the passed messageContent
				setExtractedContent(messageContent);
			}
		}
	}, [messageData, messageContent]);

	return (
		<>
			<AddMessageToTaskModal
				isOpen={isAddToTaskModalOpen}
				onClose={() => setIsAddToTaskModalOpen(false)}
				messageId={messageId as Id<"messages">}
				workspaceId={workspaceId}
				messageContent={extractedContent}
			/>

			<div className="absolute right-5 top-0">
				<div className="rounded-md border bg-white dark:bg-gray-800 dark:border-gray-700 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
					<Hint label={isSelected ? "Deselect message" : "Select message"}>
						<Button
							variant="ghost"
							size="iconSm"
							onClick={() => toggleMessageSelection(messageId as any)}
							className={isSelected ? "text-blue-500 dark:text-blue-400" : "dark:text-white dark:hover:text-blue-400"}
						>
							<CheckSquare className="size-4" />
						</Button>
					</Hint>

					<EmojiPopover hint="Add reaction" onEmojiSelect={handleReaction}>
						<Button variant="ghost" size="iconSm" disabled={isPending} className="dark:text-white dark:hover:text-blue-400">
							<Smile className="size-4" />
						</Button>
					</EmojiPopover>

					<Hint label="Add to tasks">
						<Button
							variant="ghost"
							size="iconSm"
							disabled={isPending}
							onClick={() => setIsAddToTaskModalOpen(true)}
							className="text-secondary hover:bg-secondary/10 dark:text-white dark:hover:text-blue-400"
						>
							<ListTodo className="size-4" />
						</Button>
					</Hint>

					{!hideThreadButton && (
						<Hint label="Reply in thread">
							<Button
								onClick={handleThread}
								variant="ghost"
								size="iconSm"
								disabled={isPending}
								className="dark:text-white dark:hover:text-blue-400"
							>
								<MessageSquareText className="size-4" />
							</Button>
						</Hint>
					)}

					{isAuthor && (
						<Hint label="Edit message">
							<Button
								onClick={handleEdit}
								variant="ghost"
								size="iconSm"
								disabled={isPending}
								className="dark:text-white dark:hover:text-blue-400"
							>
								<Pencil className="size-4" />
							</Button>
						</Hint>
					)}

					{isAuthor && (
						<Hint label="Delete message">
							<Button
								onClick={handleDelete}
								variant="ghost"
								size="iconSm"
								disabled={isPending}
								className="dark:text-white dark:hover:text-blue-400"
							>
								<Trash className="size-4" />
							</Button>
						</Hint>
					)}
				</div>
			</div>
		</>
	);
};
