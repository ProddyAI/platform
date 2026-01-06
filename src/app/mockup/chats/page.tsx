"use client";

import { MessageSquare } from "lucide-react";
import { useState } from "react";
import {
	TestChatsHeader,
	TestChatsInput,
	TestChatsMessages,
	TestChatsSidebar,
	TestDailyRecap,
	TestLiveCursors,
	TestNavigation,
	useTestLiveCursors,
} from "@/app/mockup/components";
import {
	TEST_CHATS,
	TEST_MESSAGES,
	TEST_SMART_REPLIES,
} from "@/app/mockup/data/shared-test-data";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

export interface ChatMessage {
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

export interface Chat {
	id: string;
	name: string;
	type: "direct" | "group" | "channel";
	participants: string[];
	lastMessage?: ChatMessage;
	unreadCount: number;
	isOnline?: boolean;
	avatar?: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

export interface SmartReply {
	id: string;
	text: string;
	context: string;
	confidence: number;
}

const TestChatsPage = () => {
	useDocumentTitle("Chats");
	const { showCursors } = useTestLiveCursors(true);

	const [selectedChatId, setSelectedChatId] = useState<string>("chat-1");
	const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
	const [showDailyRecap, setShowDailyRecap] = useState(false);
	const [chats, setChats] = useState<Chat[]>(TEST_CHATS as unknown as Chat[]);
	const [messages, setMessages] = useState<ChatMessage[]>(TEST_MESSAGES);
	const [smartReplies, setSmartReplies] =
		useState<SmartReply[]>(TEST_SMART_REPLIES);

	const selectedChat = chats.find((chat) => chat.id === selectedChatId);
	const chatMessages = messages.filter((msg) => msg.chatId === selectedChatId);

	const handleSendMessage = (content: string, replyTo?: string) => {
		const newMessage: ChatMessage = {
			id: `msg-${Date.now()}`,
			chatId: selectedChatId,
			senderId: "current-user",
			senderName: "You",
			content,
			timestamp: new Date(),
			type: "text",
			isRead: true,
			replyTo,
		};

		setMessages((prev) => [...prev, newMessage]);

		// Update chat's last message
		setChats((prev) =>
			prev.map((chat) =>
				chat.id === selectedChatId
					? { ...chat, lastMessage: newMessage, updatedAt: new Date() }
					: chat
			)
		);

		// Generate new smart replies based on the message
		generateSmartReplies(content);
	};

	const generateSmartReplies = (lastMessage: string) => {
		// Context-aware smart reply generation based on actual conversation content
		const replies: SmartReply[] = [];
		const lowerMessage = lastMessage.toLowerCase();

		// Payment API related responses
		if (
			lowerMessage.includes("payment") ||
			lowerMessage.includes("api") ||
			lowerMessage.includes("stripe")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "The integration is working perfectly!",
					context: "payment-api",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "All tests are passing ✅",
					context: "payment-api",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Ready for production deployment",
					context: "payment-api",
					confidence: 0.7,
				}
			);
		}
		// Meeting scheduling responses
		else if (
			lowerMessage.includes("meeting") ||
			lowerMessage.includes("schedule") ||
			lowerMessage.includes("review")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Tomorrow morning works for me",
					context: "meeting",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "I'll send a calendar invite",
					context: "meeting",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Let's do it at 10 AM",
					context: "meeting",
					confidence: 0.7,
				}
			);
		}
		// Database/Performance responses
		else if (
			lowerMessage.includes("database") ||
			lowerMessage.includes("performance") ||
			lowerMessage.includes("optimization")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Amazing improvement! 🚀",
					context: "database",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "The queries are much faster now",
					context: "database",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Great work on the indexing!",
					context: "database",
					confidence: 0.7,
				}
			);
		}
		// Sprint/Team coordination responses
		else if (
			lowerMessage.includes("sprint") ||
			lowerMessage.includes("team") ||
			lowerMessage.includes("progress")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Excellent progress everyone! 🎉",
					context: "sprint",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "We're ahead of schedule",
					context: "sprint",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Let's keep the momentum going",
					context: "sprint",
					confidence: 0.7,
				}
			);
		}
		// Security audit responses
		else if (
			lowerMessage.includes("security") ||
			lowerMessage.includes("audit") ||
			lowerMessage.includes("issues")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Thanks for the thorough review!",
					context: "security",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "I'll address those today",
					context: "security",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Security is our top priority",
					context: "security",
					confidence: 0.7,
				}
			);
		}
		// UI/Design responses
		else if (
			lowerMessage.includes("ui") ||
			lowerMessage.includes("design") ||
			lowerMessage.includes("wireframe")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "The new design looks fantastic!",
					context: "design",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "Much better user experience",
					context: "design",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Ready for user testing",
					context: "design",
					confidence: 0.7,
				}
			);
		}
		// Gratitude responses
		else if (
			lowerMessage.includes("thanks") ||
			lowerMessage.includes("thank you") ||
			lowerMessage.includes("great work")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "You're welcome! Happy to help",
					context: "gratitude",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "Team effort! 💪",
					context: "gratitude",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Anytime! We're crushing it",
					context: "gratitude",
					confidence: 0.7,
				}
			);
		}
		// Question responses
		else if (
			lowerMessage.includes("?") ||
			lowerMessage.includes("how") ||
			lowerMessage.includes("what")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Let me check and get back to you",
					context: "question",
					confidence: 0.8,
				},
				{
					id: "reply-2",
					text: "Good question! Let me investigate",
					context: "question",
					confidence: 0.7,
				},
				{
					id: "reply-3",
					text: "I'll look into that right away",
					context: "question",
					confidence: 0.6,
				}
			);
		}
		// Demo/presentation responses
		else if (
			lowerMessage.includes("demo") ||
			lowerMessage.includes("presentation") ||
			lowerMessage.includes("show")
		) {
			replies.push(
				{
					id: "reply-1",
					text: "Demo is ready to go! 🎬",
					context: "demo",
					confidence: 0.9,
				},
				{
					id: "reply-2",
					text: "I'll walk through the features",
					context: "demo",
					confidence: 0.8,
				},
				{
					id: "reply-3",
					text: "Should be impressive!",
					context: "demo",
					confidence: 0.7,
				}
			);
		}
		// General positive responses
		else {
			replies.push(
				{
					id: "reply-1",
					text: "Sounds perfect! 👍",
					context: "general",
					confidence: 0.7,
				},
				{
					id: "reply-2",
					text: "Absolutely, let's do it",
					context: "general",
					confidence: 0.6,
				},
				{
					id: "reply-3",
					text: "I'm on it!",
					context: "general",
					confidence: 0.5,
				}
			);
		}

		setSmartReplies(replies);
	};

	const handleReaction = (messageId: string, emoji: string) => {
		setMessages((prev) =>
			prev.map((msg) => {
				if (msg.id === messageId) {
					const reactions = msg.reactions || [];
					const existingReaction = reactions.find((r) => r.emoji === emoji);

					if (existingReaction) {
						// Toggle reaction
						if (existingReaction.users.includes("current-user")) {
							existingReaction.users = existingReaction.users.filter(
								(u) => u !== "current-user"
							);
							if (existingReaction.users.length === 0) {
								return {
									...msg,
									reactions: reactions.filter((r) => r.emoji !== emoji),
								};
							}
						} else {
							existingReaction.users.push("current-user");
						}
					} else {
						reactions.push({ emoji, users: ["current-user"] });
					}

					return { ...msg, reactions };
				}
				return msg;
			})
		);
	};

	const handleMarkAsRead = (chatId: string) => {
		setChats((prev) =>
			prev.map((chat) =>
				chat.id === chatId ? { ...chat, unreadCount: 0 } : chat
			)
		);
	};

	return (
		<div className="flex h-full flex-col">
			{/* Generic Header */}
			<div className="border-b bg-primary p-4">
				<div className="flex items-center justify-between">
					<Button
						variant="ghost"
						className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
						size="sm"
					>
						<MessageSquare className="mr-2 size-5" />
						<span className="truncate">Chats</span>
					</Button>

					<TestNavigation />
				</div>
			</div>

			{/* Specific Chats Header */}
			<TestChatsHeader
				selectedChat={selectedChat}
				onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
				sidebarCollapsed={sidebarCollapsed}
				onShowDailyRecap={() => setShowDailyRecap(true)}
			/>

			<div className="flex flex-1 overflow-hidden">
				<TestChatsSidebar
					chats={chats}
					selectedChatId={selectedChatId}
					onChatSelect={setSelectedChatId}
					collapsed={sidebarCollapsed}
					onMarkAsRead={handleMarkAsRead}
				/>

				<div className="flex-1 flex flex-col overflow-hidden">
					{selectedChat ? (
						<>
							<div className="flex-1 overflow-hidden">
								<TestChatsMessages
									messages={chatMessages}
									currentUserId="current-user"
									onReaction={handleReaction}
								/>
							</div>

							<TestChatsInput
								onSendMessage={handleSendMessage}
								smartReplies={smartReplies}
								placeholder={`Message ${selectedChat.name}...`}
							/>
						</>
					) : (
						<div className="flex items-center justify-center h-full text-muted-foreground">
							<div className="text-center">
								<div className="text-lg font-medium mb-2">No chat selected</div>
								<div className="text-sm">
									Select a chat from the sidebar to start messaging
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* Daily Recap Modal */}
			{showDailyRecap && (
				<TestDailyRecap onClose={() => setShowDailyRecap(false)} />
			)}

			{/* Live Cursors */}
			<TestLiveCursors enabled={showCursors} maxCursors={3} />
		</div>
	);
};

export default TestChatsPage;
