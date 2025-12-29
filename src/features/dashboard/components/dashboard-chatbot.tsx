"use client";

import { useState, useRef, useEffect } from "react";
import {
  Bot,
  Send,
  Loader,
  Info,
  AlertCircle,
  Trash2,
  Calendar,
  FileText,
  Kanban,
  CheckSquare,
  MessageSquare,
  ExternalLink,
  Github,
  Mail,
  CheckCircle,
  Zap,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/components/ui/use-toast";
import { Id } from "@/../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/../convex/_generated/api";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { MentionPicker } from "@/components/mention-picker";
import { ChannelPicker } from "@/components/channel-picker";
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

export const DashboardChatbot = ({
  workspaceId,
  member,
}: DashboardChatbotProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [integrationStatus, setIntegrationStatus] = useState<{
    connected: any[];
    totalTools: number;
    loading: boolean;
  }>({ connected: [], totalTools: 0, loading: true });
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const [isInitialized, setIsInitialized] = useState(false);
  const router = useRouter();

  // Autocomplete for @users and #channels in the chatbot input
  const [autocompleteOpen, setAutocompleteOpen] = useState(false);
  const [activeAutocomplete, setActiveAutocomplete] = useState<
    "mention" | "channel" | null
  >(null);
  const [autocompleteQuery, setAutocompleteQuery] = useState("");
  const [autocompleteStartIndex, setAutocompleteStartIndex] = useState<number | null>(null);
  const [autocompleteCursorIndex, setAutocompleteCursorIndex] = useState<number | null>(null);
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

  const handleMentionInsert = (_memberId: Id<"members">, memberName: string) => {
    replaceAutocompleteToken(`@${memberName} `);
    closeAutocomplete();
  };

  const handleChannelInsert = (_channelId: Id<"channels">, channelName: string) => {
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
  }, [autocompleteOpen]);

  // Get workspace data
  const workspace = useQuery(api.workspaces.getById, { id: workspaceId });

  // Get chat history from Convex
  const chatHistory = useQuery(api.chatbot.getChatHistory, { workspaceId });

  // Convex mutations
  const clearChatHistoryMutation = useMutation(api.chatbot.clearChatHistory);
  const addMessageMutation = useMutation(api.chatbot.addMessage);

  // Initialize messages from chat history
  useEffect(() => {
    if (chatHistory && !isInitialized) {
      if (chatHistory.messages && chatHistory.messages.length > 0) {
        // Convert Convex chat history to our Message format
        const formattedMessages = chatHistory.messages.map((msg, index) => ({
          id: index.toString(),
          content: msg.content,
          sender: msg.role as "user" | "assistant",
          role: msg.role as "user" | "assistant", // Ensure role is set
          timestamp: new Date(msg.timestamp),
          sources: msg.sources
            ? msg.sources.map((source) => ({
                id: source.id,
                type: source.type,
                text: source.text,
              }))
            : undefined,
          actions: (msg as any).actions || undefined,
        }));
        setMessages(formattedMessages);
      } else {
        // Set basic welcome message - will be updated when integration status loads
        setMessages([
          {
            id: "1",
            content: `Hello! I'm your workspace assistant. I can help you with:

• **Workspace Content**: Search messages, tasks, notes, and board cards
• **Navigation**: Find and navigate to specific workspace content

I'm checking for available integrations...`,
            sender: "assistant",
            role: "assistant",
            timestamp: new Date(),
          },
        ]);
      }
      setIsInitialized(true);
    }
  }, [chatHistory, isInitialized]);

  // Update welcome message when integration status changes
  useEffect(() => {
    if (!integrationStatus.loading && isInitialized) {
      // Only update if it's the initial welcome message
      if (
        messages.length === 1 &&
        messages[0].id === "1" &&
        messages[0].content.includes("checking for available integrations")
      ) {
        const connectedApps = integrationStatus.connected;
        const hasGitHub = connectedApps.some(
          (app: any) => app.app === "GITHUB",
        );
        const hasGmail = connectedApps.some((app: any) => app.app === "GMAIL");

        let content = `Hello! I'm your workspace assistant. I can help you with:

• **Workspace Content**: Search messages, tasks, notes, and board cards`;

        if (hasGitHub) {
          content += `
• **GitHub Integration**: List repositories, create issues, manage pull requests`;
        }

        if (hasGmail) {
          content += `
• **Gmail Integration**: Send emails, read messages, manage drafts`;
        }

        content += `
• **Navigation**: Find and navigate to specific workspace content

Try asking me things like:`;

        if (hasGitHub) {
          content += `
- "List my repositories"`;
        }

        content += `
- "What are my recent tasks?"`;

        if (hasGmail) {
          content += `
- "Send an email to [email]"`;
        }

        content += `
- "Show me recent messages"`;

        if (!hasGitHub && !hasGmail) {
          content += `

*Note: Connect GitHub or Gmail integrations to unlock more capabilities!*`;
        }

        setMessages([
          {
            id: "1",
            content,
            sender: "assistant",
            role: "assistant",
            timestamp: new Date(),
          },
        ]);
      }
    }
  }, [integrationStatus, isInitialized, messages]);

  // Check integration status
  useEffect(() => {
    const checkIntegrations = async () => {
      try {
        const response = await fetch(
          `/api/connections/status?workspaceId=${workspaceId}`,
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

    if (workspaceId) {
      checkIntegrations();
    }
  }, [workspaceId]);

  // Scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages]);

  const handleSendMessage = async () => {
    if (!input.trim()) return;

    // Add user message to UI
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      role: "user", // Add role property
      timestamp: new Date(),
    };

    // Store the message for later use
    const userQuery = input.trim();

    // Update UI immediately
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      console.log("Sending message to assistant:", userQuery);

      // Get workspace context for assistant integration
      const workspaceContext = workspace ? `Workspace: ${workspace.name}` : "";

      // Prepare conversation history for the API (take last 6 exchanges)
      const conversationHistory = messages
        .slice(-12) // Last 12 messages (6 exchanges) - reduced from 20
        .map((msg) => ({
          role: msg.role || msg.sender, // Use role if available, fallback to sender
          content:
            msg.content.length > 500
              ? msg.content.substring(0, 500) + "..."
              : msg.content, // Truncate long messages
        }));

      console.log(
        "Sending conversation history:",
        conversationHistory.length,
        "messages",
      );

      // Call the main assistant router API
      const response = await fetch("/api/assistant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          message: userQuery,
          workspaceContext,
          workspaceId,
          conversationHistory,
        }),
      });

      if (!response.ok) {
        throw new Error(
          `Assistant API error: ${response.status} ${response.statusText}`,
        );
      }

      const result = await response.json();

      // Validate response
      if (!result) {
        throw new Error("Empty response from assistant API");
      }

      if (result.error) {
        console.error("Error from assistant API:", result.error);
        throw new Error(result.error);
      }

      if (!result.response) {
        throw new Error("Missing response content from assistant API");
      }

      console.log("Received response from assistant");

      // Save user message to Convex
      await addMessageMutation({
        workspaceId,
        content: userQuery,
        role: "user",
      });

      // Save assistant response to Convex
      await addMessageMutation({
        workspaceId,
        content: result.response,
        role: "assistant",
        sources: result.sources,
        actions: result.actions,
      });

      // Add assistant response to UI
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: result.response,
        sender: "assistant",
        role: "assistant", // Add role property
        timestamp: new Date(),
        sources: result.sources,
        actions: result.actions,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error) {
      console.error("Error in chatbot:", error);

      // Extract error message
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error occurred";

      // Add fallback response with error details for better debugging
      const fallbackMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: `I'm having trouble connecting right now. Please try again later. ${
          process.env.NODE_ENV === "development"
            ? `(Error: ${errorMessage})`
            : ""
        }`,
        sender: "assistant",
        role: "assistant",
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, fallbackMessage]);

      toast({
        title: "Assistant Error",
        description: "Failed to get a response from the assistant.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
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
      await clearChatHistoryMutation({ workspaceId });

      // Reset UI messages
      setMessages([
        {
          id: Date.now().toString(),
          content:
            "Hello! I'm your workspace assistant. How can I help you today?",
          sender: "assistant",
          role: "assistant",
          timestamp: new Date(),
        },
      ]);
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
  const cleanSourceText = (text: string, type: string) => {
    // Remove markdown formatting for cleaner display
    let cleaned = text
      .replace(/#{1,6}\s/g, "") // Remove markdown headers
      .replace(/\*\*(.*?)\*\*/g, "$1") // Remove bold formatting
      .replace(/\*(.*?)\*/g, "$1") // Remove italic formatting
      .replace(/\n+/g, " ") // Replace newlines with spaces
      .trim();

    // Truncate if too long
    if (cleaned.length > 100) {
      cleaned = cleaned.substring(0, 100) + "...";
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
            <Button variant="outline" size="sm" className="h-6 px-2 text-xs">
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
                {sources.map((source, index) => (
                  <div
                    key={index}
                    className="text-xs p-2 bg-muted/50 rounded border"
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
          <Badge key={type} variant="outline" className="text-xs px-2 py-0.5">
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
                ) : (
                  <>
                    {integrationStatus.connected.length > 0 ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-2 text-xs hover:bg-green-50 dark:hover:bg-green-950"
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
                              {integrationStatus.connected.map((app: any) => (
                                <div
                                  key={app.app}
                                  className="flex items-center gap-3 p-2 bg-green-50 dark:bg-green-950/30 rounded border"
                                >
                                  {app.app === "GITHUB" && (
                                    <Github className="h-4 w-4 text-gray-800 dark:text-gray-200" />
                                  )}
                                  {app.app === "GMAIL" && (
                                    <Mail className="h-4 w-4 text-red-600" />
                                  )}
                                  <div className="flex-1">
                                    <div className="font-medium text-sm">
                                      {app.app}
                                    </div>
                                    <div className="text-xs text-muted-foreground">
                                      {app.app === "GITHUB" &&
                                        "Repository management, issues, pull requests"}
                                      {app.app === "GMAIL" &&
                                        "Email sending, reading, and management"}
                                    </div>
                                  </div>
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                </div>
                              ))}
                            </div>
                            <div className="text-xs text-muted-foreground pt-2 border-t">
                              {integrationStatus.totalTools} tools available for
                              enhanced productivity
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <Badge variant="outline" className="text-xs px-2 py-0.5">
                        No integrations
                      </Badge>
                    )}
                  </>
                )}
              </div>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={clearConversation}
            className="text-xs text-muted-foreground hover:text-destructive border border-gray-300"
          >
            <Trash2 className="h-3.5 w-3.5 mr-1.5" />
            Clear chat
          </Button>
        </div>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <ScrollArea className="h-[calc(100vh-240px)] px-4" ref={scrollAreaRef}>
          <div className="flex flex-col gap-4 py-4 pb-10">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${
                  message.sender === "user" ? "justify-end" : "justify-start"
                }`}
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
                        remarkPlugins={[remarkGfm]}
                        components={{
                          // Custom link component to handle internal links
                          a: ({ href, children, ...props }) => (
                            <a
                              href={href}
                              className="text-primary hover:text-primary/80 underline"
                              target={
                                href?.startsWith("http") ? "_blank" : "_self"
                              }
                              rel={
                                href?.startsWith("http")
                                  ? "noopener noreferrer"
                                  : undefined
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
                      >
                        {message.content}
                      </ReactMarkdown>
                    </div>
                  )}
                  {message.sources && renderSourceBadges(message.sources)}
                  {message.actions && message.actions.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-3">
                      {message.actions.map((action, index) => (
                        <Button
                          key={index}
                          variant="outline"
                          size="sm"
                          onClick={() => handleNavigation(action)}
                          className="h-8 px-3 text-xs bg-primary/5 hover:bg-primary/10 border-primary/20"
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
                  <div className="flex items-center gap-2">
                    <Loader className="h-4 w-4 animate-spin" />
                    <div>
                      <p className="text-sm font-medium">Thinking...</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        Searching workspace content for relevant information
                      </p>
                    </div>
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
                open={autocompleteOpen}
                onClose={closeAutocomplete}
                onSelect={handleChannelInsert}
                searchQuery={autocompleteQuery}
              />
            ) : (
              <MentionPicker
                open={autocompleteOpen}
                onClose={closeAutocomplete}
                onSelect={handleMentionInsert}
                searchQuery={autocompleteQuery}
              />
            )}
          </div>
        )}

        <div className="flex w-full items-center gap-2">
          <Input
            ref={inputRef}
            placeholder="Ask a question about your workspace..."
            value={input}
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
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
};
