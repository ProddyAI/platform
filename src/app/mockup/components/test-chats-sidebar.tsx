"use client";

import { format } from "date-fns";
import {
	Hash,
	MessageCircle,
	MessageSquare,
	Plus,
	Search,
	Users,
} from "lucide-react";
import { useState } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface Chat {
	id: string;
	name: string;
	type: "direct" | "group" | "channel";
	participants: string[];
	lastMessage?: {
		content: string;
		timestamp: Date;
		senderName: string;
	};
	unreadCount: number;
	isOnline?: boolean;
	avatar?: string;
	description?: string;
	createdAt: Date;
	updatedAt: Date;
}

interface TestChatsSidebarProps {
	chats: Chat[];
	selectedChatId: string | null;
	onChatSelect: (chatId: string) => void;
	collapsed: boolean;
	onMarkAsRead: (chatId: string) => void;
}

export const TestChatsSidebar = ({
	chats,
	selectedChatId,
	onChatSelect,
	collapsed,
	onMarkAsRead,
}: TestChatsSidebarProps) => {
	const [searchQuery, setSearchQuery] = useState("");
	const [filterType, setFilterType] = useState<
		"all" | "direct" | "group" | "channel"
	>("all");

	const getInitials = (name: string) => {
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.toUpperCase();
	};

	const getChatIcon = (type: string) => {
		switch (type) {
			case "group":
				return <Users className="h-4 w-4 text-muted-foreground" />;
			case "channel":
				return <Hash className="h-4 w-4 text-muted-foreground" />;
			default:
				return <MessageCircle className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const filteredChats = chats.filter((chat) => {
		const matchesSearch = chat.name
			.toLowerCase()
			.includes(searchQuery.toLowerCase());
		const matchesFilter = filterType === "all" || chat.type === filterType;
		return matchesSearch && matchesFilter;
	});

	// Sort chats by last message timestamp
	const sortedChats = filteredChats.sort((a, b) => {
		const aTime = a.lastMessage?.timestamp || a.updatedAt;
		const bTime = b.lastMessage?.timestamp || b.updatedAt;
		return bTime.getTime() - aTime.getTime();
	});

	const totalUnread = chats.reduce((sum, chat) => sum + chat.unreadCount, 0);

	if (collapsed) {
		return (
			<div className="w-16 border-r bg-muted/30 flex flex-col items-center py-4 gap-2">
				<Button variant="ghost" size="sm">
					<Plus className="h-4 w-4" />
				</Button>
				{totalUnread > 0 && (
					<Badge variant="destructive" className="text-xs">
						{totalUnread > 99 ? "99+" : totalUnread}
					</Badge>
				)}
				<div className="text-xs text-muted-foreground transform -rotate-90 whitespace-nowrap mt-8">
					Chats
				</div>
			</div>
		);
	}

	return (
		<div className="w-80 border-r bg-muted/30 flex flex-col">
			{/* Search and Filters */}
			<div className="p-4 border-b">
				<div className="flex gap-2 mb-3">
					<div className="relative flex-1">
						<Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
						<Input
							placeholder="Search chats..."
							value={searchQuery}
							onChange={(e) => setSearchQuery(e.target.value)}
							className="pl-9"
						/>
					</div>
					<Button size="sm">
						<Plus className="h-4 w-4" />
					</Button>
				</div>

				{/* Chat Type Filters */}
				<div className="flex gap-1 flex-wrap">
					<Button
						variant={filterType === "all" ? "default" : "ghost"}
						size="sm"
						onClick={() => setFilterType("all")}
						className="text-xs h-7"
					>
						All
						{totalUnread > 0 && (
							<Badge variant="secondary" className="ml-1 text-xs">
								{totalUnread}
							</Badge>
						)}
					</Button>
					<Button
						variant={filterType === "direct" ? "default" : "ghost"}
						size="sm"
						onClick={() => setFilterType("direct")}
						className="text-xs h-7"
					>
						<MessageCircle className="h-3 w-3 mr-1" />
						Direct
					</Button>
					<Button
						variant={filterType === "group" ? "default" : "ghost"}
						size="sm"
						onClick={() => setFilterType("group")}
						className="text-xs h-7"
					>
						<Users className="h-3 w-3 mr-1" />
						Groups
					</Button>
					<Button
						variant={filterType === "channel" ? "default" : "ghost"}
						size="sm"
						onClick={() => setFilterType("channel")}
						className="text-xs h-7"
					>
						<Hash className="h-3 w-3 mr-1" />
						Channels
					</Button>
				</div>
			</div>

			{/* Chats List */}
			<ScrollArea className="flex-1">
				<div className="p-2">
					{sortedChats.map((chat) => (
						<button
							key={chat.id}
							onClick={() => {
								onChatSelect(chat.id);
								if (chat.unreadCount > 0) {
									onMarkAsRead(chat.id);
								}
							}}
							className={cn(
								"w-full text-left p-3 rounded-lg border transition-colors mb-1",
								selectedChatId === chat.id
									? "bg-primary/10 border-primary/20"
									: "bg-background hover:bg-muted/50 border-transparent"
							)}
						>
							<div className="flex items-start gap-3">
								<div className="relative">
									<Avatar className="h-10 w-10">
										<AvatarFallback className="text-sm">
											{getInitials(chat.name)}
										</AvatarFallback>
									</Avatar>
									{chat.type === "direct" && chat.isOnline && (
										<div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
									)}
								</div>

								<div className="flex-1 min-w-0">
									<div className="flex items-center justify-between mb-1">
										<div className="flex items-center gap-2 min-w-0 flex-1">
											<span
												className={cn(
													"font-medium text-sm truncate",
													chat.unreadCount > 0 && "font-semibold"
												)}
											>
												{chat.name}
											</span>
											{getChatIcon(chat.type)}
										</div>

										<div className="flex items-center gap-2 flex-shrink-0">
											{chat.lastMessage && (
												<span className="text-xs text-muted-foreground">
													{format(chat.lastMessage.timestamp, "HH:mm")}
												</span>
											)}
											{chat.unreadCount > 0 && (
												<Badge variant="destructive" className="text-xs">
													{chat.unreadCount > 99 ? "99+" : chat.unreadCount}
												</Badge>
											)}
										</div>
									</div>

									{chat.lastMessage && (
										<div className="text-xs text-muted-foreground line-clamp-2">
											<span className="font-medium">
												{chat.lastMessage.senderName}:{" "}
											</span>
											{chat.lastMessage.content}
										</div>
									)}

									{chat.description && !chat.lastMessage && (
										<div className="text-xs text-muted-foreground line-clamp-1">
											{chat.description}
										</div>
									)}
								</div>
							</div>
						</button>
					))}

					{sortedChats.length === 0 && (
						<div className="text-center py-8 text-muted-foreground">
							<MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
							<div className="text-sm">No chats found</div>
							<div className="text-xs mt-1">
								{searchQuery
									? "Try a different search term"
									: "Start a new conversation"}
							</div>
						</div>
					)}
				</div>
			</ScrollArea>
		</div>
	);
};
