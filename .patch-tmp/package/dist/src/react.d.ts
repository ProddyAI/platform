/**
 * React hooks for DatabaseChat component.
 *
 * NOTE: This file is for FRONTEND use only. Import from your React app.
 *
 * @example
 * ```tsx
 * // 1. Set up your chat wrapper in convex/chat.ts to expose required endpoints:
 * //    - getMessages (query)
 * //    - listConversations (query)
 * //    - getStreamState (query) - wraps stream.getStream
 * //    - getStreamDeltas (query) - wraps stream.listDeltas
 * //    - createConversation (mutation)
 * //    - abortStream (mutation) - wraps stream.abortByConversation
 * //    - sendMessage (action)
 *
 * // 2. Create the provider with your API:
 * import { useDatabaseChat, DatabaseChatProvider } from "@dayhaysoos/convex-database-chat";
 * import { api } from "../convex/_generated/api";
 *
 * function ChatApp() {
 *   return (
 *     <DatabaseChatProvider api={{
 *       getMessages: api.chat.getMessages,
 *       listConversations: api.chat.listConversations,
 *       getStreamState: api.chat.getStreamState,
 *       getStreamDeltas: api.chat.getStreamDeltas,
 *       createConversation: api.chat.createConversation,
 *       abortStream: api.chat.abortStream,
 *       sendMessage: api.chat.sendMessage,
 *     }}>
 *       <ChatInterface />
 *     </DatabaseChatProvider>
 *   );
 * }
 *
 * // 3. Use the hook in your components:
 * function ChatInterface() {
 *   const [conversationId, setConversationId] = useState<string | null>(null);
 *
 *   const {
 *     messages,
 *     streamingContent,
 *     isStreaming,
 *     isLoading,
 *     error,
 *     send,
 *     abort,
 *   } = useDatabaseChat({ conversationId });
 *
 *   return (
 *     <div>
 *       {messages?.map(msg => <Message key={msg._id} {...msg} />)}
 *       {streamingContent && <StreamingMessage content={streamingContent} />}
 *       {isStreaming && <button onClick={abort}>Stop</button>}
 *       <ChatInput onSend={send} disabled={isLoading} />
 *     </div>
 *   );
 * }
 * ```
 */
import { type ReactNode } from "react";
import type { FunctionReference } from "convex/server";
export interface DatabaseChatApi {
    getMessages: FunctionReference<"query">;
    listConversations: FunctionReference<"query">;
    getStreamState: FunctionReference<"query">;
    getStreamDeltas: FunctionReference<"query">;
    createConversation: FunctionReference<"mutation">;
    abortStream: FunctionReference<"mutation">;
    sendMessage: FunctionReference<"action">;
}
export interface Message {
    _id: string;
    role: "user" | "assistant" | "tool";
    content: string;
    toolCalls?: Array<{
        id: string;
        name: string;
        arguments: string;
    }>;
    toolResults?: Array<{
        toolCallId: string;
        result: string;
    }>;
    createdAt: number;
}
export interface StreamState {
    streamId: string;
    status: "streaming" | "finished" | "aborted";
    startedAt: number;
    endedAt?: number;
    abortReason?: string;
}
export interface StreamDelta {
    start: number;
    end: number;
    parts: StreamPart[];
}
export interface StreamPart {
    type: "text-delta" | "tool-call" | "tool-result" | "error";
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: string;
    result?: string;
    error?: string;
}
export interface UseDatabaseChatOptions {
    /** Conversation ID to chat in */
    conversationId: string | null;
    /** Callback when a message is sent successfully */
    onMessageSent?: (content: string) => void;
    /** Callback when an error occurs */
    onError?: (error: Error) => void;
    /**
     * Callback when stream is aborted.
     * Called after the abort mutation completes.
     */
    onAbort?: () => void;
}
export interface UseDatabaseChatReturn {
    /** Messages in the conversation */
    messages: Message[] | undefined;
    /** Current streaming content (while assistant is responding) */
    streamingContent: string | null;
    /** Whether the assistant is currently responding */
    isStreaming: boolean;
    /** Whether a message is being sent */
    isLoading: boolean;
    /** Current error, if any */
    error: Error | null;
    /** Send a message */
    send: (message: string) => Promise<void>;
    /** Clear the current error */
    clearError: () => void;
    /** Retry the last failed message */
    retry: () => Promise<void>;
    /** Abort the current stream (stop generation) */
    abort: () => Promise<void>;
}
export interface UseConversationsOptions {
    /** External ID to filter conversations (e.g., user ID) */
    externalId: string;
}
export interface UseConversationsReturn {
    /** List of conversations */
    conversations: Array<{
        _id: string;
        title?: string;
        createdAt: number;
        updatedAt: number;
    }> | undefined;
    /** Create a new conversation */
    create: (title?: string) => Promise<string>;
    /** Whether a conversation is being created */
    isCreating: boolean;
    /** Current error, if any */
    error: Error | null;
}
export interface DatabaseChatProviderProps {
    /** The API object with chat functions */
    api: DatabaseChatApi;
    children: ReactNode;
}
/**
 * Provider for DatabaseChat hooks.
 * Wrap your app or chat section with this provider.
 */
export declare function DatabaseChatProvider({ api, children, }: DatabaseChatProviderProps): import("react/jsx-runtime").JSX.Element;
/**
 * Main hook for chat functionality.
 * Uses delta-based streaming for efficient O(n) bandwidth.
 *
 * @example
 * ```tsx
 * function Chat({ conversationId }) {
 *   const {
 *     messages,
 *     streamingContent,
 *     isLoading,
 *     error,
 *     send,
 *   } = useDatabaseChat({ conversationId });
 *
 *   return (
 *     <div>
 *       {messages?.map(msg => <Message key={msg._id} {...msg} />)}
 *       {streamingContent && <StreamingMessage content={streamingContent} />}
 *       <ChatInput onSend={send} disabled={isLoading} />
 *       {error && <ErrorBanner error={error} />}
 *     </div>
 *   );
 * }
 * ```
 */
export declare function useDatabaseChat(options: UseDatabaseChatOptions): UseDatabaseChatReturn;
/**
 * Hook for managing conversations.
 *
 * @example
 * ```tsx
 * function ConversationList({ userId }) {
 *   const { conversations, create, isCreating } = useConversations({
 *     externalId: `user:${userId}`,
 *   });
 *
 *   return (
 *     <div>
 *       <button onClick={() => create("New Chat")} disabled={isCreating}>
 *         New Conversation
 *       </button>
 *       {conversations?.map(conv => (
 *         <ConversationItem key={conv._id} {...conv} />
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export declare function useConversations(options: UseConversationsOptions): UseConversationsReturn;
/**
 * Hook for streaming content with delta-based accumulation.
 * Use this if you want to isolate streaming updates to a specific component
 * to avoid re-rendering the entire message list.
 *
 * @example
 * ```tsx
 * function StreamingIndicator({ conversationId }) {
 *   const { content, isStreaming } = useStreamingContent({ conversationId });
 *
 *   if (!isStreaming) return null;
 *
 *   return <div className="streaming">{content}</div>;
 * }
 * ```
 */
export declare function useStreamingContent(options: {
    conversationId: string | null;
}): {
    content: string | null;
    isStreaming: boolean;
};
/**
 * Combine streaming content with completed messages for display.
 * Useful for rendering the full conversation including in-progress responses.
 */
export declare function useMessagesWithStreaming(options: {
    conversationId: string | null;
}): {
    allMessages: Array<Message | {
        _id: "streaming";
        role: "assistant";
        content: string;
    }>;
    isStreaming: boolean;
};
export interface UseSmoothTextOptions {
    /**
     * Initial characters per second for smoothing.
     * Will adapt over time to match the actual text arrival rate.
     * @default 200
     */
    initialCharsPerSecond?: number;
    /**
     * Whether to start streaming immediately.
     * Set to true for streaming messages, false for completed messages.
     * @default false
     */
    startStreaming?: boolean;
    /**
     * Minimum delay between character updates in ms.
     * @default 10
     */
    minDelayMs?: number;
    /**
     * Maximum delay between character updates in ms.
     * @default 100
     */
    maxDelayMs?: number;
}
/**
 * Hook that smooths text rendering for a typewriter effect.
 * Useful for streaming text to avoid jarring jumps when chunks arrive.
 *
 * @example
 * ```tsx
 * function StreamingMessage({ text, isStreaming }) {
 *   const [visibleText] = useSmoothText(text, {
 *     startStreaming: isStreaming,
 *   });
 *   return <div>{visibleText}</div>;
 * }
 * ```
 */
export declare function useSmoothText(text: string | null | undefined, options?: UseSmoothTextOptions): [string, boolean];
export interface SmoothTextProps extends UseSmoothTextOptions {
    /** The text to display with smoothing */
    text: string | null | undefined;
    /** Optional className for the wrapper span */
    className?: string;
}
/**
 * Component that renders text with a smooth typewriter effect.
 *
 * @example
 * ```tsx
 * <SmoothText
 *   text={streamingContent}
 *   startStreaming={isStreaming}
 * />
 * ```
 */
export declare function SmoothText({ text, className, ...options }: SmoothTextProps): JSX.Element;
//# sourceMappingURL=react.d.ts.map