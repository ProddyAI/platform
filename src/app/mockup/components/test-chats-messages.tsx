"use client";

import { format } from "date-fns";
import { Calendar, MoreHorizontal, Plus, Reply, Smile } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";

import { cn } from "@/lib/utils";

interface ChatMessage {
	id: string;
	chatId: string;
	senderId: string;
	senderName: string;
	senderAvatar?: string;
	content: string;
	timestamp: Date;
	type: "text" | "image" | "file" | "system";
	isRead: boolean;
	reactions?: { emoji: string; users: string[] }[];
	replyTo?: string;
}

interface TestChatsMessagesProps {
	messages: ChatMessage[];
	currentUserId: string;
	onReaction: (messageId: string, emoji: string) => void;
}

const commonEmojis = ["👍", "❤️", "😂", "😮", "😢", "😡"];

export const TestChatsMessages = ({
	messages,
	currentUserId,
	onReaction,
}: TestChatsMessagesProps) => {
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const messagesEndRef = useRef<HTMLDivElement>(null);
	const [showTaskModal, setShowTaskModal] = useState(false);
	const [selectedMessage, setSelectedMessage] = useState<ChatMessage | null>(
		null
	);
	const [taskTitle, setTaskTitle] = useState("");
	const [taskContent, setTaskContent] = useState("");
	const [taskDueDate, setTaskDueDate] = useState("");
	const [contextMenu, setContextMenu] = useState<{
		show: boolean;
		x: number;
		y: number;
		message: ChatMessage | null;
	}>({ show: false, x: 0, y: 0, message: null });

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	const handleAddToTask = (message: ChatMessage) => {
		setSelectedMessage(message);
		setTaskTitle(`Task from ${message.senderName}`);
		setTaskContent(message.content);
		setShowTaskModal(true);
	};

	const handleTaskCreate = () => {
		// Here you would typically save the task to your backend
		console.log("Creating task from message:", {
			title: taskTitle,
			content: taskContent,
			dueDate: taskDueDate,
			originalMessage: selectedMessage,
		});

		// Reset states
		setShowTaskModal(false);
		setSelectedMessage(null);
		setTaskTitle("");
		setTaskContent("");
		setTaskDueDate("");
	};

	const handleDeleteMessage = (messageId: string) => {
		// Here you would typically delete the message from your backend
		console.log("Deleting message:", messageId);
	};

	const handleContextMenu = (e: React.MouseEvent, message: ChatMessage) => {
		e.preventDefault();
		setContextMenu({
			show: true,
			x: e.clientX,
			y: e.clientY,
			message,
		});
	};

	const handleCloseContextMenu = () => {
		setContextMenu({ show: false, x: 0, y: 0, message: null });
	};

	const handleContextMenuAction = (action: string) => {
		if (!contextMenu.message) return;

		switch (action) {
			case "addToTask":
				handleAddToTask(contextMenu.message);
				break;
			case "copy":
				navigator.clipboard.writeText(contextMenu.message.content);
				break;
			case "delete":
				handleDeleteMessage(contextMenu.message.id);
				break;
			default:
				console.log(`Action: ${action} for message:`, contextMenu.message.id);
		}
		handleCloseContextMenu();
	};

	useEffect(() => {
		scrollToBottom();
	}, [scrollToBottom]);

	// Close context menu when clicking outside
	useEffect(() => {
		const handleClickOutside = () => {
			if (contextMenu.show) {
				handleCloseContextMenu();
			}
		};

		document.addEventListener("click", handleClickOutside);
		return () => document.removeEventListener("click", handleClickOutside);
	}, [contextMenu.show, handleCloseContextMenu]);

	const groupedMessages = messages.reduce(
		(groups, message) => {
			const date = format(message.timestamp, "yyyy-MM-dd");
			if (!groups[date]) {
				groups[date] = [];
			}
			groups[date].push(message);
			return groups;
		},
		{} as Record<string, ChatMessage[]>
	);

	const isConsecutiveMessage = (
		currentMsg: ChatMessage,
		prevMsg: ChatMessage | undefined
	) => {
		if (!prevMsg) return false;
		const timeDiff =
			currentMsg.timestamp.getTime() - prevMsg.timestamp.getTime();
		return (
			prevMsg.senderId === currentMsg.senderId && timeDiff < 5 * 60 * 1000 // 5 minutes
		);
	};

	const renderMessage = (
		message: ChatMessage,
		index: number,
		dayMessages: ChatMessage[]
	) => {
		const isCurrentUser = message.senderId === currentUserId;
		const prevMessage = index > 0 ? dayMessages[index - 1] : undefined;
		const isConsecutive = isConsecutiveMessage(message, prevMessage);

		return (
			<div
				className={cn(
					"flex gap-3 group hover:bg-muted/30 px-4 py-1 transition-colors",
					isCurrentUser && "flex-row-reverse"
				)}
				key={message.id}
			>
				{/* Avatar */}
				<div className="flex-shrink-0">
					{!isConsecutive ? (
						<Avatar className="h-8 w-8">
							<AvatarFallback className="text-xs">
								{getInitials(message.senderName)}
							</AvatarFallback>
						</Avatar>
					) : (
						<div className="w-8 h-8 flex items-center justify-center">
							<span className="text-xs text-muted-foreground opacity-0 group-hover:opacity-100">
								{format(message.timestamp, "HH:mm")}
							</span>
						</div>
					)}
				</div>

				{/* Message Content */}
				<div className={cn("flex-1 min-w-0", isCurrentUser && "text-right")}>
					{!isConsecutive && (
						<div
							className={cn(
								"flex items-baseline gap-2 mb-1",
								isCurrentUser && "flex-row-reverse"
							)}
						>
							<span className="font-medium text-sm">{message.senderName}</span>
							<span className="text-xs text-muted-foreground">
								{format(message.timestamp, "HH:mm")}
							</span>
						</div>
					)}

					<div
						className={cn(
							"relative group/message",
							isCurrentUser && "flex justify-end"
						)}
					>
						<div
							className={cn(
								"max-w-md rounded-lg px-3 py-2 text-sm cursor-pointer",
								isCurrentUser
									? "bg-primary text-primary-foreground"
									: "bg-muted"
							)}
							onContextMenu={(e) => handleContextMenu(e, message)}
						>
							{message.content}
						</div>

						{/* Message Actions */}
						<div
							className={cn(
								"absolute top-0 opacity-0 group-hover/message:opacity-100 transition-opacity flex gap-1",
								isCurrentUser ? "-left-20" : "-right-20"
							)}
						>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button className="h-6 w-6 p-0" size="sm" variant="ghost">
										<Smile className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<div className="flex gap-1 p-1">
										{commonEmojis.map((emoji) => (
											<button
												className="hover:bg-muted rounded p-1 text-sm"
												key={emoji}
												onClick={() => onReaction(message.id, emoji)}
											>
												{emoji}
											</button>
										))}
									</div>
								</DropdownMenuContent>
							</DropdownMenu>

							<Button className="h-6 w-6 p-0" size="sm" variant="ghost">
								<Reply className="h-3 w-3" />
							</Button>

							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<Button className="h-6 w-6 p-0" size="sm" variant="ghost">
										<MoreHorizontal className="h-3 w-3" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent>
									<DropdownMenuItem onClick={() => handleAddToTask(message)}>
										<Plus className="h-4 w-4 mr-2" />
										Add to Task
									</DropdownMenuItem>
									<DropdownMenuSeparator />
									<DropdownMenuItem>Copy Message</DropdownMenuItem>
									<DropdownMenuItem>Forward</DropdownMenuItem>
									<DropdownMenuItem>Pin Message</DropdownMenuItem>
									{isCurrentUser && (
										<>
											<DropdownMenuSeparator />
											<DropdownMenuItem>Edit</DropdownMenuItem>
											<DropdownMenuItem
												className="text-destructive"
												onClick={() => handleDeleteMessage(message.id)}
											>
												Delete
											</DropdownMenuItem>
										</>
									)}
								</DropdownMenuContent>
							</DropdownMenu>
						</div>
					</div>

					{/* Reactions */}
					{message.reactions && message.reactions.length > 0 && (
						<div
							className={cn(
								"flex gap-1 mt-1 flex-wrap",
								isCurrentUser && "justify-end"
							)}
						>
							{message.reactions.map((reaction) => (
								<button
									className={cn(
										"flex items-center gap-1 px-2 py-1 rounded-full text-xs border transition-colors",
										reaction.users.includes(currentUserId)
											? "bg-primary/10 border-primary/20 text-primary"
											: "bg-muted border-border hover:bg-muted/80"
									)}
									key={reaction.emoji}
									onClick={() => onReaction(message.id, reaction.emoji)}
								>
									<span>{reaction.emoji}</span>
									<span>{reaction.users.length}</span>
								</button>
							))}
						</div>
					)}
				</div>
			</div>
		);
	};

	return (
		<ScrollArea className="flex-1" ref={scrollAreaRef}>
			<div className="py-4">
				{Object.entries(groupedMessages).map(([date, dayMessages]) => (
					<div key={date}>
						{/* Date Separator */}
						<div className="flex items-center justify-center py-4">
							<div className="bg-muted px-3 py-1 rounded-full text-xs text-muted-foreground">
								{format(new Date(date), "EEEE, MMMM d, yyyy")}
							</div>
						</div>

						{/* Messages for this day */}
						{dayMessages.map((message, index) =>
							renderMessage(message, index, dayMessages)
						)}
					</div>
				))}

				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full text-muted-foreground">
						<div className="text-center">
							<div className="text-lg font-medium mb-2">No messages yet</div>
							<div className="text-sm">Start the conversation!</div>
						</div>
					</div>
				)}

				<div ref={messagesEndRef} />
			</div>

			{/* Custom Context Menu */}
			{contextMenu.show && (
				<div
					className="fixed bg-white border rounded-lg shadow-lg py-1 z-50 min-w-[160px]"
					onClick={(e) => e.stopPropagation()}
					style={{
						left: contextMenu.x,
						top: contextMenu.y,
					}}
				>
					<button
						className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
						onClick={() => handleContextMenuAction("copy")}
					>
						Copy Message
					</button>
					<button
						className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
						onClick={() => handleContextMenuAction("forward")}
					>
						Forward
					</button>
					<hr className="my-1" />
					<button
						className="w-full px-3 py-2 text-left text-sm bg-primary text-primary-foreground hover:bg-primary/90 flex items-center gap-2 font-medium"
						onClick={() => handleContextMenuAction("addToTask")}
					>
						<Plus className="h-4 w-4" />
						Add to Task
					</button>
					<hr className="my-1" />
					<button
						className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
						onClick={() => handleContextMenuAction("pin")}
					>
						Pin Message
					</button>
					{contextMenu.message?.senderId === currentUserId && (
						<>
							<button
								className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
								onClick={() => handleContextMenuAction("edit")}
							>
								Edit
							</button>
							<button
								className="w-full px-3 py-2 text-left text-sm hover:bg-muted text-destructive"
								onClick={() => handleContextMenuAction("delete")}
							>
								Delete
							</button>
						</>
					)}
				</div>
			)}

			{/* Task Creation Modal */}
			<Dialog onOpenChange={setShowTaskModal} open={showTaskModal}>
				<DialogContent className="max-w-md">
					<DialogHeader>
						<DialogTitle className="flex items-center gap-2">
							<Calendar className="h-5 w-5" />
							Create Task from Message
						</DialogTitle>
					</DialogHeader>

					<div className="space-y-4">
						<div className="space-y-2">
							<Label htmlFor="taskTitle">Task Title</Label>
							<Input
								id="taskTitle"
								onChange={(e) => setTaskTitle(e.target.value)}
								placeholder="Enter task title..."
								value={taskTitle}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="taskContent">Task Description</Label>
							<Textarea
								className="resize-none"
								id="taskContent"
								onChange={(e) => setTaskContent(e.target.value)}
								placeholder="Task description..."
								rows={3}
								value={taskContent}
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="taskDueDate">Due Date (Optional)</Label>
							<Input
								id="taskDueDate"
								onChange={(e) => setTaskDueDate(e.target.value)}
								type="date"
								value={taskDueDate}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button onClick={() => setShowTaskModal(false)} variant="outline">
								Cancel
							</Button>
							<Button onClick={handleTaskCreate}>Create Task</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</ScrollArea>
	);
};
