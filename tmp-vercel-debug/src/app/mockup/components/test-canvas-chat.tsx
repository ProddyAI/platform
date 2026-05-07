"use client";

import { ExternalLink, MessageSquare, Send } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface ChatMessage {
	id: string;
	sender: string;
	initials: string;
	message: string;
	timestamp: Date;
	isCurrentUser: boolean;
}

interface TestCanvasChatProps {
	onViewAllChats?: () => void;
}

export const TestCanvasChat = ({ onViewAllChats }: TestCanvasChatProps) => {
	const [newMessage, setNewMessage] = useState("");
	const router = useRouter();

	// Mock chat messages
	const [messages, setMessages] = useState<ChatMessage[]>([
		{
			id: "1",
			sender: "Alex Rodriguez",
			initials: "AR",
			message: "Great work on the payment flow diagram! 🎉",
			timestamp: new Date(Date.now() - 5 * 60 * 1000),
			isCurrentUser: false,
		},
		{
			id: "2",
			sender: "Sarah Johnson",
			initials: "SJ",
			message: "Should we add the error handling states to the wireframe?",
			timestamp: new Date(Date.now() - 3 * 60 * 1000),
			isCurrentUser: false,
		},
		{
			id: "3",
			sender: "You",
			initials: "YU",
			message:
				"Yes, let me add those now. Also thinking about the mobile responsive version.",
			timestamp: new Date(Date.now() - 2 * 60 * 1000),
			isCurrentUser: true,
		},
		{
			id: "4",
			sender: "Maya Patel",
			initials: "MP",
			message: "The color scheme looks perfect! Matches our design system.",
			timestamp: new Date(Date.now() - 1 * 60 * 1000),
			isCurrentUser: false,
		},
	]);

	const handleSendMessage = () => {
		if (!newMessage.trim()) return;

		const message: ChatMessage = {
			id: Date.now().toString(),
			sender: "You",
			initials: "YU",
			message: newMessage,
			timestamp: new Date(),
			isCurrentUser: true,
		};

		setMessages((prev) => [...prev, message]);
		setNewMessage("");
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const handleViewAllChats = () => {
		router.push("/mockup/chats");
		onViewAllChats?.();
	};

	const formatTime = (date: Date) => {
		return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
	};

	return (
		<div className="w-80 bg-white border-l border-gray-200 flex flex-col h-full">
			{/* Header */}
			<div className="flex items-center justify-between p-4 border-b bg-gray-50">
				<div className="flex items-center gap-2">
					<MessageSquare className="h-5 w-5 text-primary" />
					<span className="font-medium text-gray-900">Canvas Chat</span>
					<Badge className="text-xs" variant="secondary">
						{messages.filter((m) => !m.isCurrentUser).length} new
					</Badge>
				</div>
			</div>

			{/* Messages */}
			<ScrollArea className="flex-1 p-3">
				<div className="space-y-3">
					{messages.map((message) => (
						<div
							className={cn(
								"flex gap-2",
								message.isCurrentUser ? "justify-end" : "justify-start"
							)}
							key={message.id}
						>
							{!message.isCurrentUser && (
								<Avatar className="h-8 w-8 flex-shrink-0">
									<AvatarFallback className="text-xs bg-primary/10 text-primary">
										{message.initials}
									</AvatarFallback>
								</Avatar>
							)}

							<div
								className={cn(
									"max-w-[70%] rounded-lg p-2",
									message.isCurrentUser
										? "bg-primary text-white"
										: "bg-gray-100 text-gray-900"
								)}
							>
								{!message.isCurrentUser && (
									<div className="text-xs font-medium mb-1 text-gray-600">
										{message.sender}
									</div>
								)}
								<div className="text-sm">{message.message}</div>
								<div
									className={cn(
										"text-xs mt-1",
										message.isCurrentUser ? "text-white/70" : "text-gray-500"
									)}
								>
									{formatTime(message.timestamp)}
								</div>
							</div>

							{message.isCurrentUser && (
								<Avatar className="h-8 w-8 flex-shrink-0">
									<AvatarFallback className="text-xs bg-primary text-white">
										{message.initials}
									</AvatarFallback>
								</Avatar>
							)}
						</div>
					))}
				</div>
			</ScrollArea>

			{/* Input */}
			<div className="p-4 border-t bg-gray-50">
				<div className="flex gap-2 mb-3">
					<Input
						className="flex-1"
						onChange={(e) => setNewMessage(e.target.value)}
						onKeyPress={handleKeyPress}
						placeholder="Type a message..."
						value={newMessage}
					/>
					<Button
						className="px-3"
						disabled={!newMessage.trim()}
						onClick={handleSendMessage}
						size="sm"
					>
						<Send className="h-4 w-4" />
					</Button>
				</div>

				<Button
					className="w-full text-sm"
					onClick={handleViewAllChats}
					size="sm"
				>
					<ExternalLink className="h-4 w-4 mr-2" />
					View All Chats
				</Button>
			</div>
		</div>
	);
};
