"use client";

import { Calendar, Mic, Paperclip, Send, Smile, Zap } from "lucide-react";
import { useRef, useState } from "react";
import { TEST_MEMBERS } from "@/app/mockup/data/shared-test-data";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

interface SmartReply {
	id: string;
	text: string;
	context: string;
	confidence: number;
}

interface TestChatsInputProps {
	onSendMessage: (content: string, replyTo?: string) => void;
	smartReplies: SmartReply[];
	placeholder?: string;
	replyTo?: {
		id: string;
		senderName: string;
		content: string;
	};
	onCancelReply?: () => void;
}

export const TestChatsInput = ({
	onSendMessage,
	smartReplies,
	placeholder = "Type a message...",
	replyTo,
	onCancelReply,
}: TestChatsInputProps) => {
	const [message, setMessage] = useState("");
	const [isRecording, setIsRecording] = useState(false);
	const [showMentions, setShowMentions] = useState(false);
	const [mentionQuery, setMentionQuery] = useState("");
	const [showTaskModal, setShowTaskModal] = useState(false);
	const [taskContent, setTaskContent] = useState("");
	const [taskTitle, setTaskTitle] = useState("");
	const [taskDueDate, setTaskDueDate] = useState("");
	const [cursorPosition, setCursorPosition] = useState(0);
	const textareaRef = useRef<HTMLTextAreaElement>(null);

	const handleSend = () => {
		if (message.trim()) {
			onSendMessage(message.trim(), replyTo?.id);
			setMessage("");
			if (textareaRef.current) {
				textareaRef.current.style.height = "auto";
			}
		}
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			if (showMentions) {
				setShowMentions(false);
				return;
			}
			handleSend();
		}
		if (e.key === "Escape") {
			setShowMentions(false);
			setShowTaskModal(false);
		}
	};

	const handleMessageChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
		const value = e.target.value;
		const cursorPos = e.target.selectionStart;

		setMessage(value);
		setCursorPosition(cursorPos);
		adjustTextareaHeight();

		// Handle @ mentions
		const beforeCursor = value.substring(0, cursorPos);
		const atIndex = beforeCursor.lastIndexOf("@");

		if (atIndex !== -1 && atIndex === beforeCursor.length - 1) {
			// Just typed @
			setShowMentions(true);
			setMentionQuery("");
		} else if (
			atIndex !== -1 &&
			beforeCursor.substring(atIndex).indexOf(" ") === -1
		) {
			// Typing after @
			const query = beforeCursor.substring(atIndex + 1);
			setMentionQuery(query);
			setShowMentions(true);
		} else {
			setShowMentions(false);
		}

		// Handle ! task creation
		if (value.includes("!") && !showTaskModal) {
			const exclamationIndex = value.lastIndexOf("!");
			const contentBeforeExclamation = value
				.substring(0, exclamationIndex)
				.trim();
			if (contentBeforeExclamation) {
				setTaskContent(contentBeforeExclamation);
				setTaskTitle(
					contentBeforeExclamation.substring(0, 50) +
						(contentBeforeExclamation.length > 50 ? "..." : "")
				);
				setShowTaskModal(true);
			}
		}
	};

	const handleMentionSelect = (member: (typeof TEST_MEMBERS)[0]) => {
		const beforeCursor = message.substring(0, cursorPosition);
		const afterCursor = message.substring(cursorPosition);
		const atIndex = beforeCursor.lastIndexOf("@");

		const newMessage =
			beforeCursor.substring(0, atIndex) +
			`@${member.user.name} ` +
			afterCursor;
		setMessage(newMessage);
		setShowMentions(false);

		// Focus back to textarea
		setTimeout(() => {
			if (textareaRef.current) {
				textareaRef.current.focus();
				const newCursorPos = atIndex + member.user.name.length + 2;
				textareaRef.current.setSelectionRange(newCursorPos, newCursorPos);
			}
		}, 0);
	};

	const handleTaskCreate = () => {
		// Here you would typically save the task to your backend
		console.log("Creating task:", {
			title: taskTitle,
			content: taskContent,
			dueDate: taskDueDate,
		});

		// Send the original message without the !
		const messageWithoutExclamation = message.replace("!", "").trim();
		if (messageWithoutExclamation) {
			onSendMessage(messageWithoutExclamation, replyTo?.id);
		}

		// Reset states
		setMessage("");
		setShowTaskModal(false);
		setTaskTitle("");
		setTaskContent("");
		setTaskDueDate("");

		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
		}
	};

	const handleSmartReply = (reply: SmartReply) => {
		onSendMessage(reply.text, replyTo?.id);
		if (onCancelReply) {
			onCancelReply();
		}
	};

	const filteredMembers = TEST_MEMBERS.filter((member) =>
		member.user.name.toLowerCase().includes(mentionQuery.toLowerCase())
	);

	const adjustTextareaHeight = () => {
		if (textareaRef.current) {
			textareaRef.current.style.height = "auto";
			textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
		}
	};

	const getConfidenceColor = (confidence: number) => {
		if (confidence >= 0.8)
			return "bg-green-100 text-green-800 border-green-200";
		if (confidence >= 0.6)
			return "bg-yellow-100 text-yellow-800 border-yellow-200";
		return "bg-gray-100 text-gray-800 border-gray-200";
	};

	return (
		<div className="border-t bg-background">
			{/* Smart Replies */}
			{smartReplies.length > 0 && (
				<div className="p-3 border-b">
					<div className="flex items-center gap-2 mb-2">
						<Zap className="h-4 w-4 text-primary" />
						<span className="text-sm font-medium text-muted-foreground">
							Smart Replies
						</span>
					</div>
					<div className="flex gap-2 flex-wrap">
						{smartReplies.map((reply) => (
							<TooltipProvider key={reply.id}>
								<Tooltip>
									<TooltipTrigger asChild>
										<button
											onClick={() => handleSmartReply(reply)}
											className={cn(
												"px-3 py-1.5 rounded-full text-sm border transition-colors hover:scale-105",
												getConfidenceColor(reply.confidence)
											)}
										>
											{reply.text}
										</button>
									</TooltipTrigger>
									<TooltipContent>
										<div className="text-xs">
											<div>Context: {reply.context}</div>
											<div>
												Confidence: {Math.round(reply.confidence * 100)}%
											</div>
										</div>
									</TooltipContent>
								</Tooltip>
							</TooltipProvider>
						))}
					</div>
				</div>
			)}

			{/* Reply Preview */}
			{replyTo && (
				<div className="p-3 border-b bg-muted/30">
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0">
							<div className="text-xs text-muted-foreground mb-1">
								Replying to {replyTo.senderName}
							</div>
							<div className="text-sm text-muted-foreground line-clamp-2 border-l-2 border-primary pl-2">
								{replyTo.content}
							</div>
						</div>
						{onCancelReply && (
							<Button
								variant="ghost"
								size="sm"
								onClick={onCancelReply}
								className="h-6 w-6 p-0"
							>
								×
							</Button>
						)}
					</div>
				</div>
			)}

			{/* Message Input */}
			<div className="p-4">
				<div className="flex items-end gap-2">
					{/* Attachment Button */}
					<Button variant="ghost" size="sm" className="flex-shrink-0">
						<Paperclip className="h-4 w-4" />
					</Button>

					{/* Text Input */}
					<div className="flex-1 relative">
						<Textarea
							ref={textareaRef}
							value={message}
							onChange={handleMessageChange}
							onKeyDown={handleKeyPress}
							placeholder={placeholder}
							className="min-h-[40px] max-h-[120px] resize-none pr-12"
							rows={1}
						/>

						{/* Mentions Dropdown */}
						{showMentions && filteredMembers.length > 0 && (
							<div className="absolute bottom-full left-0 right-0 mb-2 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto z-50">
								<div className="p-2 text-xs text-muted-foreground border-b">
									Select a user to mention
								</div>
								{filteredMembers.map((member) => (
									<button
										key={member._id}
										onClick={() => handleMentionSelect(member)}
										className="w-full flex items-center gap-3 p-3 hover:bg-muted transition-colors text-left"
									>
										<Avatar className="h-8 w-8">
											<AvatarFallback className="text-xs">
												{member.user.name
													.split(" ")
													.map((n) => n[0])
													.join("")}
											</AvatarFallback>
										</Avatar>
										<div>
											<div className="font-medium text-sm">
												{member.user.name}
											</div>
											<div className="text-xs text-muted-foreground">
												@{member.user.name.toLowerCase().replace(" ", "")}
											</div>
										</div>
									</button>
								))}
							</div>
						)}

						{/* Emoji Button */}
						<Button
							variant="ghost"
							size="sm"
							className="absolute right-2 top-1/2 transform -translate-y-1/2 h-6 w-6 p-0"
						>
							<Smile className="h-4 w-4" />
						</Button>
					</div>

					{/* Voice/Send Button */}
					{message.trim() ? (
						<Button onClick={handleSend} size="sm" className="flex-shrink-0">
							<Send className="h-4 w-4" />
						</Button>
					) : (
						<Button
							variant="ghost"
							size="sm"
							className={cn(
								"flex-shrink-0",
								isRecording && "bg-red-100 text-red-600"
							)}
							onMouseDown={() => setIsRecording(true)}
							onMouseUp={() => setIsRecording(false)}
							onMouseLeave={() => setIsRecording(false)}
						>
							<Mic className="h-4 w-4" />
						</Button>
					)}
				</div>

				{/* Typing Indicator */}
				<div className="mt-2 text-xs text-muted-foreground">
					{isRecording && (
						<div className="flex items-center gap-1">
							<div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
							Recording voice message...
						</div>
					)}
				</div>
			</div>

			{/* Task Creation Modal */}
			<Dialog open={showTaskModal} onOpenChange={setShowTaskModal}>
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
								value={taskTitle}
								onChange={(e) => setTaskTitle(e.target.value)}
								placeholder="Enter task title..."
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="taskContent">Task Description</Label>
							<Textarea
								id="taskContent"
								value={taskContent}
								onChange={(e) => setTaskContent(e.target.value)}
								placeholder="Task description..."
								rows={3}
								className="resize-none"
							/>
						</div>

						<div className="space-y-2">
							<Label htmlFor="taskDueDate">Due Date (Optional)</Label>
							<Input
								id="taskDueDate"
								type="date"
								value={taskDueDate}
								onChange={(e) => setTaskDueDate(e.target.value)}
							/>
						</div>

						<div className="flex justify-end gap-2">
							<Button variant="outline" onClick={() => setShowTaskModal(false)}>
								Cancel
							</Button>
							<Button onClick={handleTaskCreate}>Create Task</Button>
						</div>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};
