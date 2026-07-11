"use client";

import { Plus } from "lucide-react";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useContextMenu } from "@/contexts/context-menu-context";
import { useMessageSelection } from "@/contexts/message-selection-context";
import type { Id } from "../../../../convex/_generated/dataModel";

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
	useMessageSelection();

	if (!contextMenu.show || contextMenu.messageId !== messageId) {
		return null;
	}

	const handleAction = (action: string) => {
		onAction(action);
		closeContextMenu();
	};

	return (
		<DropdownMenu
			onOpenChange={(open) => {
				if (!open) {
					closeContextMenu();
				}
			}}
			open
		>
			<DropdownMenuTrigger asChild>
				{/* Invisible anchor positioned at the cursor; the real menu is Radix's
				 * portaled, focus-trapped, keyboard-navigable DropdownMenuContent below. */}
				<button
					aria-hidden="true"
					className="fixed size-0"
					style={{ left: contextMenu.x, top: contextMenu.y }}
					tabIndex={-1}
					type="button"
				/>
			</DropdownMenuTrigger>
			<DropdownMenuContent
				align="start"
				className="min-w-[180px]"
				onClick={(e) => e.stopPropagation()}
				onCloseAutoFocus={(e) => e.preventDefault()}
				side="bottom"
			>
				<DropdownMenuCheckboxItem
					checked={isSelected}
					onCheckedChange={() => handleAction("select")}
				>
					{isSelected ? "Selected" : "Select Message"}
				</DropdownMenuCheckboxItem>
				<DropdownMenuItem onClick={() => handleAction("copy")}>
					Copy Message
				</DropdownMenuItem>

				<DropdownMenuSeparator />

				<DropdownMenuItem onClick={() => handleAction("addToTask")}>
					<Plus className="mr-2 size-4" />
					Add as Task
				</DropdownMenuItem>

				{isAuthor && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => handleAction("edit")}>
							Edit
						</DropdownMenuItem>
						<DropdownMenuItem
							className="text-destructive focus:text-destructive"
							onClick={() => handleAction("delete")}
						>
							Delete
						</DropdownMenuItem>
					</>
				)}

				{!hideThreadButton && (
					<>
						<DropdownMenuSeparator />
						<DropdownMenuItem onClick={() => handleAction("reply")}>
							Reply in Thread
						</DropdownMenuItem>
					</>
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
};
