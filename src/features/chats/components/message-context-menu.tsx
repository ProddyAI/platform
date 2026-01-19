"use client";

import { Plus } from "lucide-react";
import { useMessageSelection } from "@/features/smart/contexts/message-selection-context";
import { cn } from "@/lib/utils";
import type { Id } from "../../../../convex/_generated/dataModel";
import { useContextMenu } from "../contexts/context-menu-context";

interface MessageContextMenuProps {
	messageId: Id<"messages">;
	isAuthor: boolean;
	isSelected: boolean;
	hideThreadButton?: boolean;
	onAction: (action: string) => void;
}

export const MessageContextMenu = ({
	messageId,
	isAuthor,
	isSelected,
	hideThreadButton,
	onAction,
}: MessageContextMenuProps) => {
	const { contextMenu, closeContextMenu } = useContextMenu();
	const { selectedMessages } = useMessageSelection();

	if (!contextMenu.show || contextMenu.messageId !== messageId) {
		return null;
	}

	const handleAction = (action: string) => {
		onAction(action);
		closeContextMenu();
	};

	const isDark = typeof window !== 'undefined' && document.documentElement.classList.contains('dark');

	return (
		<div
			className="context-menu fixed border border-gray-200 dark:border-gray-600 rounded-lg shadow-2xl z-[9999999] min-w-[180px] overflow-hidden"
			style={{
				left: `${contextMenu.x}px`,
				top: `${contextMenu.y}px`,
				pointerEvents: "auto",
				backgroundColor: isDark ? '#1a1a1a' : '#ffffff',
			}}
			onClick={(e) => e.stopPropagation()}
		>
			{/* Message Actions Section */}
			<div>
				<button
					className={cn(
						"w-full px-4 py-2.5 text-left text-sm flex items-center gap-2 transition-colors",
						isSelected
							? "bg-blue-50 dark:bg-gray-800 text-blue-600 dark:text-blue-300 font-medium"
							: "text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800"
					)}
					onClick={() => handleAction("select")}
				>
					{isSelected ? "✓ Selected" : "Select Message"}
				</button>
				<button
					className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
					onClick={() => handleAction("copy")}
				>
					Copy Message
				</button>
			</div>

			<hr className="my-1 border-gray-200 dark:border-gray-700" />

			{/* Primary Action */}
			<button
				className="w-full px-4 py-2.5 text-left text-sm bg-primary text-white hover:bg-primary/90 dark:bg-purple-600 dark:hover:bg-purple-700 flex items-center gap-2 font-medium transition-colors"
				onClick={() => handleAction("addToTask")}
			>
				<Plus className="h-4 w-4" />
				Add as Task
			</button>

			<hr className="my-1 border-gray-200 dark:border-gray-700" />

			{/* Edit/Delete Section (Author only) */}
			{isAuthor && (
				<div>
					{isAuthor && (
						<button
							className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
							onClick={() => handleAction("edit")}
						>
							Edit
						</button>
					)}
					{isAuthor && (
						<button
							className="w-full px-4 py-2.5 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-gray-800 transition-colors"
							onClick={() => handleAction("delete")}
						>
							Delete
						</button>
					)}
				</div>
			)}

			{/* Thread Section */}
			{!hideThreadButton && (
				<>
					{isAuthor && (
						<hr className="my-1 border-gray-200 dark:border-gray-700" />
					)}
					<button
						className="w-full px-4 py-2.5 text-left text-sm text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
						onClick={() => handleAction("reply")}
					>
						Reply in Thread
					</button>
				</>
			)}
		</div>
	);
};
