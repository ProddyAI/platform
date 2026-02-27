"use client";

import {
	DatabaseChatProvider,
	useDatabaseChat,
	useMessagesWithStreaming,
} from "@dayhaysoos/convex-database-chat";
import { useMutation } from "convex/react";
import {
	Bot,
	Calendar,
	CheckCircle,
	CheckSquare,
	ExternalLink,
	FileText,
	Github,
	Info,
	Kanban,
	Loader,
	Mail,
	MessageSquare,
	Send,
	Trash2,
	Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
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
import { Input } from "@/components/ui/input";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/components/ui/use-toast";

interface DashboardChatbotProps {
	workspaceId: Id<"workspaces">;
	member: any;
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
	role?: "user" | "assistant"; // Add role property for API compatibility
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

export const DashboardChatbot = ({
	workspaceId,
	member,
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
		<DashboardChatbotBody member={member} workspaceId={workspaceId} />
	</DatabaseChatProvider>
);

const DashboardChatbotBody = ({
	workspaceId,
	member,
}: DashboardChatbotProps) => {
	const [conversationId, setConversationId] = useState<string | null>(null);
	const [welcomeMessage, setWelcomeMessage] = useState<Message | null>(null);
	const [input, setInput] = useState("");
	const [integrationStatus, setIntegrationStatus] = useState<{
		connected: IntegrationStatusApp[];
		totalTools: number;
		loading: boolean;
	}>({ connected: [], totalTools: 0, loading: true });
	const scrollAreaRef = useRef<HTMLDivElement>(null);
	const { toast } = useToast();
	const router = useRouter();

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

	const findAutocompleteTrigger = (text: string, cursorIndex: number) => {
		const prefix = text.slice(0, cursorIndex);
		const atIndex = prefix.lastIndexOf("@");
		const hashIndex = prefix.lastIndexOf("#");
		const startIndex = Math.max(atIndex, hashIndex);
		if (startIndex < 0) return null;

		const triggerChar = prefix[startIndex];
		const type = triggerChar === "@" ? "mention" : "channel";

		// Only treat it as a trigger if it starts a token
		const charBefore = startIndex > 0 ? prefix[startIndex - 1] : "";
		if (startIndex > 0 && !/\s/.test(charBefore)) return null;

		const query = prefix.slice(startIndex + 1);
		// Close if user typed whitespace in the token
		if (/\s/.test(query)) return null;

		return { type, startIndex, query, cursorIndex } as const;
	};

	const closeAutocomplete = () => {
		setAutocompleteOpen(false);
		setActiveAutocomplete(null);
		setAutocompleteQuery("");
		setAutocompleteStartIndex(null);
		setAutocompleteCursorIndex(null);
	};

	const replaceAutocompleteToken = (replacement: string) => {
		const start = autocompleteStartIndex;
		const end = autocompleteCursorIndex;
		if (start === null || end === null) return;

		const newText = input.slice(0, start) + replacement + input.slice(end);
		setInput(newText);

		// Restore caret after React state update
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

	const displayMessages: Message[] = allMessages.map((msg, index) => ({
		id: String((msg as any)._id ?? index),
		content: msg.content ?? "",
		sender: msg.role === "user" ? "user" : "assistant",
		role: msg.role === "user" ? "user" : "assistant",
		timestamp: new Date((msg as any)._creationTime ?? Date.now()),
	}));

	const renderedMessages = displayMessages.length
		? displayMessages
		: welcomeMessage
			? [welcomeMessage]
			: [];

	useEffect(() => {
		if (!conversationId && workspaceId && member?.userId) {
			createConversation({
				workspaceId,
				userId: member.userId,
				title: "Assistant Chat",
			}).then(setConversationId);
		}
	}, [conversationId, workspaceId, member, createConversation]);

	// Update welcome message when integration status changes
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
				// Pass memberId to get user-specific integrations
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

	// Scroll to bottom when messages change (e.g. after sending or receiving)
	useEffect(() => {
		if (scrollAreaRef.current) {
			const scrollContainer = scrollAreaRef.current.querySelector(
				"[data-radix-scroll-area-viewport]"
			);
			if (scrollContainer) {
				scrollContainer.scrollTop = scrollContainer.scrollHeight;
			}
		}
	}, []);

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

		// Prevent sending while picker is open
		if (e.key === "Enter" && autocompleteOpen) {
			e.preventDefault();
			return;
		}

		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const clearConversation = async () => {
		try {
			if (isStreaming) {
				await abort();
			}
			const newConversationId = await createConversation({
				workspaceId,
				userId: member.userId,
				title: "Assistant Chat",
				forceNew: true,
			});
			setConversationId(newConversationId);
			setWelcomeMessage(null);
			toast({
				title: "Success",
				description: "Chat history cleared.",
			});
		} catch (error) {
			console.error("Error clearing chat history:", error);
			toast({
				title: "Error",
				description: "Failed to clear conversation history.",
				variant: "destructive",
			});
		}
	};

	// Handle navigation actions
	const handleNavigation = (action: NavigationAction) => {
		let url = action.url.replace("[workspaceId]", workspaceId);

		// Handle channelId replacement
		if (url.includes("[channelId]") && action.channelId) {
			url = url.replace("[channelId]", action.channelId);
		}

		// Handle noteId replacement
		if (url.includes("[noteId]") && action.noteId) {
			url = url.replace("[noteId]", action.noteId);
		}

		router.push(url);
	};

	// Get icon for action type
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

	// Helper function to clean and format source text
	const cleanSourceText = (text: string, _type: string) => {
		// Remove markdown formatting for cleaner display
		let cleaned = text
			.replace(/#{1,6}\s/g, "") // Remove markdown headers
			.replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold formatting
			.replace(/\*(.*?)\*/g, "$1") // Remove italic formatting
			.replace(/\n+/g, " ") // Replace newlines with spaces
			.trim();

		// Truncate if too long
		if (cleaned.length > 100) {
			cleaned = `${cleaned.substring(0, 100)}...`;
		}

		return cleaned;
	};

	// Helper function to get source type display name
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

	// Helper function to render source badges
	const renderSourceBadges = (sources: Message["sources"]) => {
		if (!sources || sources.length === 0) return null;

		// Group sources by type
		const sourcesByType: Record<string, number> = {};
		sources.forEach((source) => {
			sourcesByType[source.type] = (sourcesByType[source.type] || 0) + 1;
		});

		return (
			<div className="flex flex-wrap gap-1.5 mt-3 mb-1">
				<Popover>
					<PopoverTrigger asChild>
						<Button className="h-6 px-2 text-xs" size="sm" variant="outline">
							<Info className="h-3 w-3 mr-1" />
							Sources ({sources.length})
						</Button>
					</PopoverTrigger>
					<PopoverContent className="w-96 p-3">
						<div className="space-y-2">
							<h4 className="font-medium text-sm">
								Sources used for this response:
							</h4>
							<div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
								{sources.map((source) => (
									<div
										className="text-xs p-2 bg-muted/50 rounded border"
										key={source.id}
									>
										<div className="font-semibold text-primary mb-1">
											{getSourceTypeDisplay(source.type)}
										</div>
										<div className="text-muted-foreground leading-relaxed">
											{cleanSourceText(source.text, source.type)}
										</div>
									</div>
								))}
							</div>
						</div>
					</PopoverContent>
				</Popover>

				{Object.entries(sourcesByType).map(([type, count]) => (
					<Badge className="text-xs px-2 py-0.5" key={type} variant="outline">
						{getSourceTypeDisplay(type)}: {count}
					</Badge>
				))}
			</div>
		);
	};

	return (
		<Card className="flex flex-col h-full shadow-md overflow-hidden">
			<CardHeader className="pb-2 border-b">
				<div className="flex items-center justify-between">
					<div className="flex items-center gap-2">
						<Avatar className="h-8 w-8 bg-primary/10">
							<AvatarFallback>
								<Bot className="h-5 w-5" />
							</AvatarFallback>
						</Avatar>
						<div>
							<CardTitle className="text-lg">Proddy AI</CardTitle>
							<div className="flex items-center gap-2 mt-1">
								{integrationStatus.loading ? (
									<div className="flex items-center gap-1">
										<Loader className="h-3 w-3 animate-spin" />
										<span className="text-xs text-muted-foreground">
											Checking integrations...
										</span>
									</div>
								) : integrationStatus.connected.length > 0 ? (
									<Popover>
										<PopoverTrigger asChild>
											<Button
												className="h-6 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-950"
												size="sm"
												variant="ghost"
											>
												<Zap className="h-3 w-3 mr-1 text-green-600" />
												<span className="text-green-700 dark:text-green-300">
													{integrationStatus.connected.length} integrations
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
													{integrationStatus.totalTools} tools available for
													enhanced productivity
												</div>
											</div>
										</PopoverContent>
									</Popover>
								) : (
									<Badge className="text-xs px-2 py-0.5" variant="outline">
										No integrations
									</Badge>
								)}
							</div>
						</div>
					</div>
					<Button
						className="text-xs text-muted-foreground hover:text-destructive border border-gray-300"
						onClick={clearConversation}
						size="sm"
						variant="ghost"
					>
						<Trash2 className="h-3.5 w-3.5 mr-1.5" />
						Clear chat
					</Button>
				</div>
			</CardHeader>
			<CardContent className="flex-1 overflow-hidden p-0">
				<ScrollArea className="h-[calc(100vh-240px)] px-4" ref={scrollAreaRef}>
					<div className="flex flex-col gap-4 py-4 pb-10">
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
													// Custom link component to handle internal links
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
													// Custom code block styling
													code: ({ className, children, ...props }) => (
														<code
															className={`${className} bg-muted px-1 py-0.5 rounded text-sm font-mono`}
															{...props}
														>
															{children}
														</code>
													),
													// Custom pre block styling
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
											<p className="text-sm font-medium">Using tools when needed</p>
											<p className="text-xs text-muted-foreground mt-1">
												Checking calendar, tasks, search, and integrations…
											</p>
											<div className="mt-2 flex flex-wrap gap-1">
												{["Calendar", "Tasks", "Search", "Integrations"].map(
													(label) => (
														<span
															key={label}
															className="inline-flex items-center rounded-md bg-background/80 px-2 py-0.5 text-xs font-medium text-muted-foreground"
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
	);
};
