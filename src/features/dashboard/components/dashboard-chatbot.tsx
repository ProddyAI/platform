"use client";

import {
	DatabaseChatProvider,
	useDatabaseChat,
	useMessagesWithStreaming,
} from "@dayhaysoos/convex-database-chat";
import { useQuery, useMutation } from "convex/react";
import {
	Bot,
	Calendar,
	Check,
	CheckCircle,
	CheckSquare,
	ChevronDown,
	Clock,
	Edit2,
	ExternalLink,
	FileText,
	Github,
	History,
	Kanban,
	Loader,
	Mail,
	MessageSquare,
	MoreVertical,
	Plus,
	Send,
	Sparkles,
	Trash2,
	X,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { ChannelPicker } from "@/components/channel-picker";
import { MentionPicker } from "@/components/mention-picker";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardFooter,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";
import { cn } from "@/lib/utils";

interface DashboardChatbotProps {
	workspaceId: Id<"workspaces">;
	member: any;
	initialPrompt?: string;
}

type NavigationAction = {
	label: string;
	type: string;
	url: string;
	noteId?: string;
	channelId?: string;
};

type Message = {
	id: string;
	content: string;
	sender: "user" | "assistant";
	role?: "user" | "assistant";
	timestamp: Date;
	sources?: Array<{
		id: string;
		type: string;
		text: string;
	}>;
	actions?: NavigationAction[];
};

type IntegrationStatusApp = {
	app: string;
	connected: boolean;
	connectionId?: string;
	entityId?: string;
};

const SUPPORTED_INTEGRATION_ORDER = [
	"GITHUB",
	"GMAIL",
	"SLACK",
	"NOTION",
	"CLICKUP",
	"LINEAR",
] as const;

type SupportedIntegration = (typeof SUPPORTED_INTEGRATION_ORDER)[number];

const INTEGRATION_METADATA: Record<
	SupportedIntegration,
	{
		name: string;
		description: string;
		welcomeCapability: string;
		examplePrompt: string;
		icon: typeof Github;
		iconClassName: string;
	}
> = {
	GITHUB: {
		name: "GitHub",
		description: "Repository management, issues, and pull requests",
		welcomeCapability: "List repositories, create issues, manage pull requests",
		examplePrompt: "List my repositories",
		icon: Github,
		iconClassName: "text-gray-800 dark:text-gray-200",
	},
	GMAIL: {
		name: "Gmail",
		description: "Email sending, reading, and management",
		welcomeCapability: "Send emails, read inbox messages, and manage drafts",
		examplePrompt: "Send an email to [email]",
		icon: Mail,
		iconClassName: "text-red-600",
	},
	SLACK: {
		name: "Slack",
		description: "Messages, channels, and workspace communication",
		welcomeCapability: "Send messages, browse channels, and review discussions",
		examplePrompt: "Post a Slack update to #team",
		icon: MessageSquare,
		iconClassName: "text-violet-600",
	},
	NOTION: {
		name: "Notion",
		description: "Pages, databases, and workspace knowledge",
		welcomeCapability: "Create pages, query databases, and find Notion content",
		examplePrompt: "Create a Notion page for sprint notes",
		icon: FileText,
		iconClassName: "text-slate-700 dark:text-slate-200",
	},
	CLICKUP: {
		name: "ClickUp",
		description: "Tasks, projects, and time tracking",
		welcomeCapability: "Create tasks, manage lists, and track project work",
		examplePrompt: "Create a ClickUp task for release QA",
		icon: CheckSquare,
		iconClassName: "text-pink-600",
	},
	LINEAR: {
		name: "Linear",
		description: "Issue tracking and project planning",
		welcomeCapability: "Create issues, update projects, and review team work",
		examplePrompt: "Create a Linear issue for onboarding bug",
		icon: Kanban,
		iconClassName: "text-blue-600",
	},
};

const getIntegrationMetadata = (app: string) =>
	INTEGRATION_METADATA[app as SupportedIntegration];

const SOURCES_HEADING = "\nSources:\n";

function inferSourceType(sourceText: string) {
	const prefix = sourceText.split(":")[0]?.trim().toLowerCase();
	switch (prefix) {
		case "task":
			return "task";
		case "note":
			return "note";
		case "message":
		case "channel messages":
			return "message";
		case "board card":
			return "card";
		case "calendar event":
			return "event";
		case "channel":
			return "channel";
		default:
			return "source";
	}
}

function parseAssistantMessageContent(content: string) {
	const markerIndex = content.lastIndexOf(SOURCES_HEADING);
	if (markerIndex < 0) {
		return { body: content, sources: [] as NonNullable<Message["sources"]> };
	}

	const body = content.slice(0, markerIndex).trimEnd();
	const rawSources = content
		.slice(markerIndex + SOURCES_HEADING.length)
		.split("\n")
		.map((line) => line.trim())
		.filter((line) => line.startsWith("- "))
		.map((line) => line.slice(2).trim())
		.filter(Boolean);

	return {
		body,
		sources: rawSources.map((sourceText, index) => ({
			id: `source-${index}-${sourceText}`,
			type: inferSourceType(sourceText),
			text: sourceText,
		})),
	};
}

function formatRelativeTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(diff / 3600000);
	const days = Math.floor(diff / 86400000);

	if (minutes < 1) return "Just now";
	if (minutes < 60) return `${minutes}m ago`;
	if (hours < 24) return `${hours}h ago`;
	if (days < 7) return `${days}d ago`;
	return new Date(timestamp).toLocaleDateString();
}

export const DashboardChatbot = ({
	workspaceId,
	member,
	initialPrompt,
}: DashboardChatbotProps) => (
	<DatabaseChatProvider
		api={{
			getMessages: api.assistantChat.getMessages,
			listConversations: api.assistantChat.listConversations,
			getStreamState: api.assistantChat.getStreamState,
			getStreamDeltas: api.assistantChat.getStreamDeltas,
			createConversation: api.assistantChat.createConversation,
			abortStream: api.assistantChat.abortStream,
			sendMessage: api.assistantChat.sendMessage,
		}}
	>
		<DashboardChatbotBody member={member} workspaceId={workspaceId} initialPrompt={initialPrompt} />
	</DatabaseChatProvider>
);

const DashboardChatbotBody = ({
	workspaceId,
	member,
	initialPrompt,
}: DashboardChatbotProps) => {
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [welcomeMessage, setWelcomeMessage] = useState<Message | null>(null);
	const [input, setInput] = useState("");
	const [integrationStatus, setIntegrationStatus] = useState<{
		connected: IntegrationStatusApp[];
		totalTools: number;
		loading: boolean;
	}>({ connected: [], totalTools: 0, loading: true });
	const [editingConversationId, setEditingConversationId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState("");
	const [isHistoryOpen, setIsHistoryOpen] = useState(false);
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();
	const router = useRouter();

	// Fetch recent conversations
	const recentConversations = useQuery(
		api.assistantConversations.listRecentConversations,
		workspaceId && member?.userId
			? { workspaceId, userId: member.userId, limit: 20 }
			: "skip"
	);

	// Autocomplete for @users and #channels in the chatbot input
	const [autocompleteOpen, setAutocompleteOpen] = useState(false);
	const [activeAutocomplete, setActiveAutocomplete] = useState<
		"mention" | "channel" | null
	>(null);
	const [autocompleteQuery, setAutocompleteQuery] = useState("");
	const [autocompleteStartIndex, setAutocompleteStartIndex] = useState<
		number | null
	>(null);
	const [autocompleteCursorIndex, setAutocompleteCursorIndex] = useState<
		number | null
	>(null);
	const inputRef = useRef<HTMLInputElement>(null);
	const autocompleteRef = useRef<HTMLDivElement>(null);
	const initialPromptSentRef = useRef<boolean>(false);
	const isNearBottomRef = useRef<boolean>(true);

	const scrollToBottom = useCallback((behavior: ScrollBehavior = "smooth") => {
		const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
			"[data-radix-scroll-area-viewport]"
		);
		if (viewport) {
			viewport.scrollTo({ top: viewport.scrollHeight, behavior });
		}
	}, []);

	const findAutocompleteTrigger = (text: string, cursorIndex: number) => {
		const prefix = text.slice(0, cursorIndex);
		const atIndex = prefix.lastIndexOf("@");
		const hashIndex = prefix.lastIndexOf("#");
		const startIndex = Math.max(atIndex, hashIndex);
		if (startIndex < 0) return null;

		const triggerChar = prefix[startIndex];
		const type = triggerChar === "@" ? "mention" : "channel";

		const charBefore = startIndex > 0 ? prefix[startIndex - 1] : "";
		if (startIndex > 0 && !/\s/.test(charBefore)) return null;

		const query = prefix.slice(startIndex + 1);
		if (/\s/.test(query)) return null;

		return { type, startIndex, query, cursorIndex } as const;
	};

	const closeAutocomplete = useCallback(() => {
		setAutocompleteOpen(false);
		setActiveAutocomplete(null);
		setAutocompleteQuery("");
		setAutocompleteStartIndex(null);
		setAutocompleteCursorIndex(null);
	}, []);

	const replaceAutocompleteToken = (replacement: string) => {
		const start = autocompleteStartIndex;
		const end = autocompleteCursorIndex;
		if (start === null || end === null) return;

		const newText = input.slice(0, start) + replacement + input.slice(end);
		setInput(newText);

		const newCursor = start + replacement.length;
		requestAnimationFrame(() => {
			inputRef.current?.focus();
			inputRef.current?.setSelectionRange(newCursor, newCursor);
		});
	};

	const handleMentionInsert = (
		_memberId: Id<"members">,
		memberName: string
	) => {
		replaceAutocompleteToken(`@${memberName} `);
		closeAutocomplete();
	};

	const handleChannelInsert = (
		_channelId: Id<"channels">,
		channelName: string
	) => {
		replaceAutocompleteToken(`#${channelName} `);
		closeAutocomplete();
	};

	useEffect(() => {
		if (!autocompleteOpen) return;

		const onMouseDown = (e: MouseEvent) => {
			const target = e.target as Node;
			if (
				autocompleteRef.current &&
				!autocompleteRef.current.contains(target) &&
				inputRef.current &&
				!inputRef.current.contains(target)
			) {
				closeAutocomplete();
			}
		};

		document.addEventListener("mousedown", onMouseDown);
		return () => document.removeEventListener("mousedown", onMouseDown);
	}, [autocompleteOpen, closeAutocomplete]);

	const createConversation = useMutation(api.assistantChat.createConversation);
	const updateConversationTitle = useMutation(api.assistantConversations.updateConversationTitle);
	const deleteConversation = useMutation(api.assistantConversations.deleteConversation);
	const {
		send,
		abort,
		isLoading: isSending,
	} = useDatabaseChat({
		conversationId,
	});
	const { allMessages, isStreaming } = useMessagesWithStreaming({
		conversationId,
	});
	const isLoading = isSending || isStreaming;

	const displayMessages: Message[] = allMessages.map((msg, index) => {
		const sender = msg.role === "user" ? "user" : "assistant";
		const parsed =
			sender === "assistant"
				? parseAssistantMessageContent(msg.content ?? "")
				: { body: msg.content ?? "", sources: [] };

		return {
			id: String((msg as any)._id ?? index),
			content: parsed.body,
			sender,
			role: sender,
			timestamp: new Date((msg as any)._creationTime ?? Date.now()),
			sources: parsed.sources,
		};
	});

	const renderedMessages = displayMessages.length
		? displayMessages
		: welcomeMessage
			? [welcomeMessage]
			: [];

	// Initialize with most recent conversation or create new one
	useEffect(() => {
		if (!conversationId && workspaceId && member?.userId) {
			if (recentConversations !== undefined && recentConversations.length > 0) {
				// Load the most recent conversation
				setConversationId(recentConversations[0].conversationId);
			} else if (recentConversations !== undefined) {
				// Query resolved as empty — create first conversation
				createConversation({
					workspaceId,
					userId: member.userId,
					title: "New Chat",
				}).then(setConversationId);
			}
			// else: recentConversations is still loading (undefined) — do nothing yet
		}
	}, [conversationId, workspaceId, member, recentConversations, createConversation]);

	// Auto-send initial prompt
	useEffect(() => {
		if (initialPrompt && conversationId && !initialPromptSentRef.current) {
			initialPromptSentRef.current = true;
			send(initialPrompt).catch((error) => {
				console.error("Error sending initial prompt:", error);
			});
		}
	}, [initialPrompt, conversationId, send]);

	// Update welcome message
	useEffect(() => {
		if (!integrationStatus.loading) {
			if (!displayMessages.length) {
				const connectedApps = integrationStatus.connected;
				const connectedSupportedIntegrations =
					SUPPORTED_INTEGRATION_ORDER.filter((integration) =>
						connectedApps.some(
							(connectedApp) => connectedApp.app === integration
						)
					);

				let content = `Hello! I'm your workspace assistant. I can help you with:

• **Workspace Content**: Search messages, tasks, notes, and board cards`;

				if (connectedSupportedIntegrations.length > 0) {
					content += `
• **Connected Integrations**:`;
					for (const integration of connectedSupportedIntegrations) {
						const metadata = getIntegrationMetadata(integration);
						if (!metadata) continue;
						content += `
• **${metadata.name}**: ${metadata.welcomeCapability}`;
					}
				}

				content += `
• **Navigation**: Find and navigate to specific workspace content

Try asking me things like:`;

				for (const integration of connectedSupportedIntegrations) {
					const metadata = getIntegrationMetadata(integration);
					if (!metadata) continue;
					content += `
- "${metadata.examplePrompt}"`;
				}

				content += `
- "What are my recent tasks?"`;

				content += `
- "Show me recent messages"`;

				if (connectedSupportedIntegrations.length === 0) {
					const supportedNames = SUPPORTED_INTEGRATION_ORDER.map(
						(integration) => {
							const metadata = getIntegrationMetadata(integration);
							return metadata?.name ?? integration;
						}
					).join(", ");
					content += `

*Note: Connect supported integrations (${supportedNames}) to unlock more capabilities!*`;
				}

				setWelcomeMessage({
					id: "welcome",
					content,
					sender: "assistant",
					role: "assistant",
					timestamp: new Date(),
				});
			}
		}
	}, [integrationStatus, displayMessages.length]);

	// Check integration status
	useEffect(() => {
		const checkIntegrations = async () => {
			try {
				const response = await fetch(
					`/api/assistant/composio/status?workspaceId=${workspaceId}&memberId=${member._id}`
				);
				if (response.ok) {
					const data = await response.json();
					setIntegrationStatus({
						connected: data.connected || [],
						totalTools: data.totalTools || 0,
						loading: false,
					});
				} else {
					setIntegrationStatus((prev) => ({ ...prev, loading: false }));
				}
			} catch (error) {
				console.warn("Failed to check integration status:", error);
				setIntegrationStatus((prev) => ({ ...prev, loading: false }));
			}
		};

		if (workspaceId && member?._id) {
			checkIntegrations();
		}
	}, [workspaceId, member]);

	// Smart scroll management
	useEffect(() => {
		const viewport = scrollAreaRef.current?.querySelector<HTMLElement>(
			"[data-radix-scroll-area-viewport]"
		);
		if (!viewport) return;

		const handleScroll = () => {
			const { scrollTop, scrollHeight, clientHeight } = viewport;
			isNearBottomRef.current = scrollHeight - scrollTop - clientHeight < 120;
		};

		viewport.addEventListener("scroll", handleScroll, { passive: true });
		return () => viewport.removeEventListener("scroll", handleScroll);
	}, []);

	useEffect(() => {
		if (!conversationId) return;
		const timer = setTimeout(() => {
			isNearBottomRef.current = true;
			scrollToBottom("instant");
		}, 100);
		return () => clearTimeout(timer);
	}, [conversationId, scrollToBottom]);

	useEffect(() => {
		if (isNearBottomRef.current) {
			scrollToBottom(isStreaming ? "instant" : "smooth");
		}
	}, [allMessages, isStreaming, scrollToBottom]);

	const handleSendMessage = async () => {
		if (!input.trim() || !conversationId) return;

		const userQuery = input.trim();
		setInput("");

		try {
			await send(userQuery);
		} catch (error) {
			const errorMessage =
				error instanceof Error ? error.message : "Unknown error occurred";
			console.error("Error in chatbot:", error);
			toast({
				title: "Assistant Error",
				description: errorMessage,
				variant: "destructive",
			});
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Escape" && autocompleteOpen) {
			e.preventDefault();
			closeAutocomplete();
			return;
		}

		if (e.key === "Enter" && autocompleteOpen) {
			e.preventDefault();
			return;
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const handleNewChat = async () => {
		try {
			if (isStreaming) {
				await abort();
			}
			const newConversationId = await createConversation({
				workspaceId,
				userId: member.userId,
				title: "New Chat",
				forceNew: true,
			});
			setConversationId(newConversationId);
			setWelcomeMessage(null);
			toast({
				title: "Success",
				description: "New chat started.",
			});
		} catch (error) {
			console.error("Error creating new chat:", error);
			toast({
				title: "Error",
				description: "Failed to create new chat.",
				variant: "destructive",
			});
		}
	};

	const handleSelectConversation = (convId: string) => {
		if (convId !== conversationId) {
			setConversationId(convId);
			setWelcomeMessage(null);
		}
	};

	const handleStartEditTitle = (convId: string, currentTitle: string) => {
		setEditingConversationId(convId);
		setEditingTitle(currentTitle || "");
	};

	const handleCancelEditTitle = () => {
		setEditingConversationId(null);
		setEditingTitle("");
	};

	const handleSaveTitle = async (convId: string) => {
		if (!editingTitle.trim()) {
			toast({
				title: "Error",
				description: "Title cannot be empty",
				variant: "destructive",
			});
			return;
		}

		try {
			await updateConversationTitle({
				conversationId: convId,
				title: editingTitle.trim(),
			});
			setEditingConversationId(null);
			setEditingTitle("");
			toast({
				title: "Success",
				description: "Chat renamed successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to rename chat",
				variant: "destructive",
			});
		}
	};

	const handleDeleteChat = async (convId: string) => {
		try {
			await deleteConversation({ conversationId: convId });
			
			// If deleting current conversation, switch to a new one
			if (convId === conversationId) {
				const remaining = recentConversations?.filter(c => c.conversationId !== convId);
				if (remaining && remaining.length > 0) {
					setConversationId(remaining[0].conversationId);
				} else {
					// Create new conversation if no others exist
					await handleNewChat();
				}
			}
			
			toast({
				title: "Success",
				description: "Chat deleted successfully",
			});
		} catch (error) {
			toast({
				title: "Error",
				description: "Failed to delete chat",
				variant: "destructive",
			});
		}
	};

	const handleNavigation = (action: NavigationAction) => {
		let url = action.url.replace("[workspaceId]", workspaceId);

		if (url.includes("[channelId]") && action.channelId) {
			url = url.replace("[channelId]", action.channelId);
		}

		if (url.includes("[noteId]") && action.noteId) {
			url = url.replace("[noteId]", action.noteId);
		}

		router.push(url);
	};

	const getActionIcon = (type: string) => {
		switch (type) {
			case "calendar":
				return <Calendar className="h-4 w-4" />;
			case "note":
				return <FileText className="h-4 w-4" />;
			case "board":
				return <Kanban className="h-4 w-4" />;
			case "task":
				return <CheckSquare className="h-4 w-4" />;
			case "message":
				return <MessageSquare className="h-4 w-4" />;
			case "github":
				return <Github className="h-4 w-4" />;
			case "gmail":
			case "email":
				return <Mail className="h-4 w-4" />;
			default:
				return <ExternalLink className="h-4 w-4" />;
		}
	};

	const getSourceTypeDisplay = (type: string) => {
		switch (type.toLowerCase()) {
			case "message":
				return "Chat Message";
			case "task":
				return "Task";
			case "note":
				return "Note";
			case "card":
				return "Board Card";
			case "event":
			case "calendar-event":
				return "Calendar Event";
			case "tool":
				return "Integration Tool";
			case "github":
				return "GitHub";
			case "gmail":
				return "Gmail";
			case "slack":
				return "Slack";
			case "notion":
				return "Notion";
			case "clickup":
				return "ClickUp";
			case "linear":
				return "Linear";
			default:
				return type.charAt(0).toUpperCase() + type.slice(1);
		}
	};

	const renderSourceBadges = (sources: Message["sources"]) => {
		if (!sources || sources.length === 0) return null;

		return (
			<div className="mt-3 rounded-md border border-border/70 bg-background/70 p-3">
				<p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
					Sources
				</p>
				<div className="mt-2 flex flex-wrap gap-1.5">
					{sources.map((source) => (
						<Badge
							className="max-w-full whitespace-normal break-words text-xs leading-relaxed"
							key={source.id}
							variant="secondary"
						>
							<span className="font-medium">{getSourceTypeDisplay(source.type)}:</span>
							<span className="ml-1">{source.text.replace(/^[^:]+:\s*/, "")}</span>
						</Badge>
					))}
				</div>
			</div>
		);
	};

	return (
		<div className="flex h-full">
			{/* Main Chat Area - Full Width */}
			<Card className="flex flex-col flex-1 shadow-md overflow-hidden">
				<CardHeader className="pb-3 border-b bg-gradient-to-r from-background to-muted/20">
					<div className="flex items-center justify-between">
						<div className="flex items-center gap-3">
							<Avatar className="h-9 w-9 bg-primary/10 ring-2 ring-primary/20">
								<AvatarFallback>
									<Bot className="h-5 w-5 text-primary" />
								</AvatarFallback>
							</Avatar>
							<div>
								<CardTitle className="text-lg font-semibold">Proddy AI</CardTitle>
								<div className="flex items-center gap-2 mt-0.5">
									{integrationStatus.loading ? (
										<div className="flex items-center gap-1">
											<Loader className="h-3 w-3 animate-spin text-muted-foreground" />
											<span className="text-xs text-muted-foreground">
												Checking integrations...
											</span>
										</div>
									) : integrationStatus.connected.length > 0 ? (
										<Popover>
											<PopoverTrigger asChild>
												<Button
													className="h-5 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-950 transition-colors"
													size="sm"
													variant="ghost"
												>
													<Zap className="h-3 w-3 mr-1 text-green-600" />
													<span className="text-green-700 dark:text-green-300 font-medium">
														{integrationStatus.connected.length} connected
													</span>
												</Button>
											</PopoverTrigger>
											<PopoverContent className="w-80 p-3">
												<div className="space-y-3">
													<h4 className="font-medium text-sm flex items-center gap-2">
														<CheckCircle className="h-4 w-4 text-green-600" />
														Connected Integrations
													</h4>
													<div className="space-y-2">
														{integrationStatus.connected.map((app) => {
															const metadata = getIntegrationMetadata(app.app);
															const Icon = metadata?.icon ?? Zap;

															return (
																<div
																	className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-950/30 rounded border"
																	key={app.app}
																>
																	<Icon
																		className={`h-4 w-4 ${metadata?.iconClassName ?? "text-green-700 dark:text-green-300"}`}
																	/>
																	<div className="flex-1">
																		<div className="font-medium text-sm">
																			{metadata?.name ?? app.app}
																		</div>
																		<div className="text-xs text-muted-foreground">
																			{metadata?.description ??
																				"Connected and available for assistant actions"}
																		</div>
																	</div>
																	<CheckCircle className="h-4 w-4 text-green-600" />
																</div>
															);
														})}
													</div>
													<div className="text-xs text-muted-foreground pt-2 border-t">
														{integrationStatus.totalTools} tools available
													</div>
												</div>
											</PopoverContent>
										</Popover>
									) : (
										<Badge className="text-xs px-2 py-0.5 h-5" variant="outline">
											No integrations
										</Badge>
									)}
								</div>
							</div>
						</div>
						
						{/* Modern Header Controls */}
						<div className="flex items-center gap-2">
							{/* New Chat Button */}
							<Button
								onClick={handleNewChat}
								size="sm"
								variant="default"
								className="h-8 px-3 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm transition-all hover:shadow-md"
							>
								<Plus className="h-4 w-4 mr-1.5" />
								New Chat
							</Button>

							{/* Recent Chats Dropdown */}
							<DropdownMenu open={isHistoryOpen} onOpenChange={setIsHistoryOpen}>
								<DropdownMenuTrigger asChild>
									<Button
										size="sm"
										variant="outline"
										className="h-8 px-3 rounded-lg border-2 hover:bg-accent transition-all"
									>
										<History className="h-4 w-4 mr-1.5" />
										Recent Chats
										<ChevronDown className="h-3 w-3 ml-1.5 opacity-50" />
									</Button>
								</DropdownMenuTrigger>
								<DropdownMenuContent
									align="end"
									className="w-80 max-h-[400px] overflow-y-auto"
									sideOffset={8}
								>
									{recentConversations && recentConversations.length > 0 ? (
										<>
											{recentConversations.map((conv, index) => (
												<div key={conv._id}>
													{index > 0 && <DropdownMenuSeparator />}
													<DropdownMenuItem
														className={cn(
															"flex items-start gap-2 p-3 cursor-pointer group",
															conversationId === conv.conversationId && "bg-accent"
														)}
														onSelect={(e) => {
															e.preventDefault();
															handleSelectConversation(conv.conversationId);
															setIsHistoryOpen(false);
														}}
													>
														<MessageSquare className="h-4 w-4 mt-0.5 flex-shrink-0 text-muted-foreground" />
														<div className="flex-1 min-w-0">
															<p
																className={`text-sm font-medium truncate transition-all duration-500 ${
																	conv.title && conv.title !== "New Chat"
																		? "opacity-100"
																		: "opacity-60"
																}`}
															>
																{conv.title || "New Chat"}
																{(conv as any).titleSource === "ai_generated" &&
																	conv.title &&
																	conv.title !== "New Chat" && (
																		<Sparkles className="inline-block ml-1 h-3 w-3 text-primary/40" />
																	)}
															</p>
															<p className="text-xs text-muted-foreground mt-0.5">
																{formatRelativeTime(conv.lastMessageAt)}
															</p>
														</div>
														<div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
															<Button
																size="sm"
																variant="ghost"
																className="h-6 w-6 p-0"
																onClick={(e) => {
																	e.stopPropagation();
																	handleStartEditTitle(conv.conversationId, conv.title || "");
																	setIsHistoryOpen(false);
																}}
															>
																<Edit2 className="h-3 w-3" />
															</Button>
															<Button
																size="sm"
																variant="ghost"
																className="h-6 w-6 p-0 hover:text-destructive"
																onClick={(e) => {
																	e.stopPropagation();
																	handleDeleteChat(conv.conversationId);
																}}
															>
																<Trash2 className="h-3 w-3" />
															</Button>
														</div>
													</DropdownMenuItem>
												</div>
											))}
										</>
									) : (
										<div className="p-4 text-center text-sm text-muted-foreground">
											No conversations yet
										</div>
									)}
								</DropdownMenuContent>
							</DropdownMenu>

							{/* Clear Chat Button */}
							<Button
								onClick={handleNewChat}
								size="sm"
								variant="ghost"
								className="h-8 px-3 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-all"
							>
								<Trash2 className="h-4 w-4 mr-1.5" />
								Clear
							</Button>
						</div>
					</div>
					
					{/* Inline Edit Mode */}
					{editingConversationId && (
						<div className="flex items-center gap-2 mt-3 p-2 bg-muted/50 rounded-lg border">
							<MessageSquare className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
							<Input
								value={editingTitle}
								onChange={(e) => setEditingTitle(e.target.value)}
								onKeyDown={(e) => {
									if (e.key === "Enter") {
										handleSaveTitle(editingConversationId);
									} else if (e.key === "Escape") {
										handleCancelEditTitle();
									}
								}}
								className="h-8 text-sm flex-1"
								placeholder="Enter chat title..."
								autoFocus
							/>
							<Button
								size="sm"
								variant="ghost"
								className="h-8 w-8 p-0"
								onClick={() => handleSaveTitle(editingConversationId)}
							>
								<Check className="h-4 w-4 text-green-600" />
							</Button>
							<Button
								size="sm"
								variant="ghost"
								className="h-8 w-8 p-0"
								onClick={handleCancelEditTitle}
							>
								<X className="h-4 w-4" />
							</Button>
						</div>
					)}
				</CardHeader>
				<CardContent className="flex-1 overflow-hidden p-0">
					<ScrollArea className="h-[calc(100vh-240px)] px-4" ref={scrollAreaRef}>
						<div className="flex flex-col gap-4 py-4 pb-4">
							{renderedMessages.map((message) => (
								<div
									className={`flex ${
										message.sender === "user" ? "justify-end" : "justify-start"
									}`}
									key={message.id}
								>
									<div
										className={`max-w-[80%] rounded-lg px-4 py-3 ${
											message.sender === "user"
												? "bg-primary text-primary-foreground"
												: "bg-muted"
										}`}
									>
										{message.sender === "user" ? (
											<p className="text-sm">{message.content}</p>
										) : (
											<div className="prose prose-sm dark:prose-invert max-w-none prose-headings:mt-2 prose-headings:mb-2 prose-p:my-1 prose-blockquote:my-2 prose-blockquote:pl-3 prose-blockquote:border-l-2 prose-blockquote:border-gray-300 prose-blockquote:italic prose-blockquote:text-gray-700 dark:prose-blockquote:text-gray-300 prose-h2:text-primary prose-h3:text-primary/90 prose-h4:text-primary/80 prose-strong:font-semibold prose-ul:my-1 prose-li:my-0.5 prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-sm prose-pre:bg-muted prose-pre:p-3 prose-pre:rounded-md prose-pre:overflow-x-auto">
												<ReactMarkdown
													components={{
														a: ({ href, children, ...props }) => (
															<a
																className="text-primary hover:text-primary/80 underline"
																href={href}
																rel={
																	href?.startsWith("http")
																		? "noopener noreferrer"
																		: undefined
																}
																target={
																	href?.startsWith("http") ? "_blank" : "_self"
																}
																{...props}
															>
																{children}
															</a>
														),
														code: ({ className, children, ...props }) => (
															<code
																className={`${className} bg-muted px-1 py-0.5 rounded text-sm font-mono`}
																{...props}
															>
																{children}
															</code>
														),
														pre: ({ children, ...props }) => (
															<pre
																className="bg-muted p-3 rounded-md overflow-x-auto text-sm"
																{...props}
															>
																{children}
															</pre>
														),
													}}
													remarkPlugins={[remarkGfm]}
												>
													{message.content}
												</ReactMarkdown>
											</div>
										)}
										{message.sources && renderSourceBadges(message.sources)}
										{message.actions && message.actions.length > 0 && (
											<div className="flex flex-wrap gap-2 mt-3">
												{message.actions.map((action) => (
													<Button
														className="h-8 px-3 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20"
														key={`${action.type}-${action.url}-${action.label}`}
														onClick={() => handleNavigation(action)}
														size="sm"
														variant="outline"
													>
														{getActionIcon(action.type)}
														<span className="ml-1.5">{action.label}</span>
													</Button>
												))}
											</div>
										)}
										<p className="mt-2 text-right text-xs opacity-70">
											{message.timestamp.toLocaleTimeString([], {
												hour: "2-digit",
												minute: "2-digit",
											})}
										</p>
									</div>
								</div>
							))}
							{isLoading && (
								<div className="flex justify-start">
									<div className="max-w-[80%] rounded-lg bg-muted px-4 py-3">
										<div className="flex items-start gap-2">
											<div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary/10">
												<Zap className="h-4 w-4 animate-pulse text-primary" />
											</div>
											<div className="min-w-0 flex-1">
												<p className="text-sm font-medium">
													Using tools when needed
												</p>
												<p className="text-xs text-muted-foreground mt-1">
													Checking calendar, tasks, search, and integrations…
												</p>
												<div className="mt-2 flex flex-wrap gap-1">
													{["Calendar", "Tasks", "Search", "Integrations"].map(
														(label) => (
															<span
																className="inline-flex items-center rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground"
																key={label}
															>
																{label}
															</span>
														)
													)}
												</div>
											</div>
											<Loader className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
										</div>
									</div>
								</div>
							)}
						</div>
					</ScrollArea>
				</CardContent>
				<CardFooter className="p-4 pt-3 border-t mt-auto">
					{autocompleteOpen && (
						<div ref={autocompleteRef}>
							{activeAutocomplete === "channel" ? (
								<ChannelPicker
									onClose={closeAutocomplete}
									onSelect={handleChannelInsert}
									open={autocompleteOpen}
									searchQuery={autocompleteQuery}
								/>
							) : (
								<MentionPicker
									onClose={closeAutocomplete}
									onSelect={handleMentionInsert}
									open={autocompleteOpen}
									searchQuery={autocompleteQuery}
								/>
							)}
						</div>
					)}

					<div className="flex w-full items-center gap-2">
						<Input
							className="flex-1"
							disabled={isLoading}
							onChange={(e) => {
								const next = e.target.value;
								const cursor = e.target.selectionStart ?? next.length;
								setInput(next);

								const trigger = findAutocompleteTrigger(next, cursor);
								if (trigger) {
									setAutocompleteOpen(true);
									setActiveAutocomplete(trigger.type);
									setAutocompleteQuery(trigger.query);
									setAutocompleteStartIndex(trigger.startIndex);
									setAutocompleteCursorIndex(trigger.cursorIndex);
								} else {
									closeAutocomplete();
								}
							}}
							onKeyDown={handleKeyDown}
							placeholder="Ask a question about your workspace..."
							ref={inputRef}
							value={input}
						/>
						<Button
							className="chat-send-button"
							disabled={isLoading || !input.trim()}
							onClick={handleSendMessage}
							size="icon"
						>
							<Send className="h-4 w-4" />
						</Button>
					</div>
				</CardFooter>
			</Card>
		</div>
	);
};
