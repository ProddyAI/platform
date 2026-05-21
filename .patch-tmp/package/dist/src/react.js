import { jsx as _jsx } from "react/jsx-runtime";
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
import { createContext, useContext, useState, useCallback, useRef, useEffect, useMemo, } from "react";
import { useQuery, useAction, useMutation } from "convex/react";
const DatabaseChatContext = createContext(null);
/**
 * Provider for DatabaseChat hooks.
 * Wrap your app or chat section with this provider.
 */
export function DatabaseChatProvider({ api, children, }) {
    return (_jsx(DatabaseChatContext.Provider, { value: { api }, children: children }));
}
function useDatabaseChatContext() {
    const context = useContext(DatabaseChatContext);
    if (!context) {
        throw new Error("useDatabaseChat must be used within a DatabaseChatProvider");
    }
    return context;
}
// =============================================================================
// Delta Accumulation Hook (Internal)
// =============================================================================
/**
 * Internal hook for accumulating stream deltas client-side.
 * This provides O(n) bandwidth instead of O(n²) by only fetching new deltas.
 */
function useStreamDeltaAccumulation(options) {
    const { api, conversationId } = options;
    // Track cursor for query and last processed position for deduplication
    const [cursor, setCursor] = useState(0);
    const [accumulatedContent, setAccumulatedContent] = useState("");
    const lastStreamIdRef = useRef(null);
    // Track the last processed end position to prevent duplicate processing
    // when useEffect runs multiple times before state updates commit
    const lastProcessedEndRef = useRef(0);
    // Subscribe to stream state
    const streamState = useQuery(api.getStreamState, conversationId ? { conversationId } : "skip");
    const streamId = streamState?.streamId ?? null;
    const status = streamState?.status ?? null;
    // Reset accumulation when stream changes
    useEffect(() => {
        if (streamId !== lastStreamIdRef.current) {
            lastStreamIdRef.current = streamId;
            lastProcessedEndRef.current = 0;
            setCursor(0);
            setAccumulatedContent("");
        }
    }, [streamId]);
    // Fetch deltas from cursor position
    const deltas = useQuery(api.getStreamDeltas, streamId && status === "streaming" ? { streamId, cursor } : "skip");
    // Accumulate new deltas with deduplication
    useEffect(() => {
        if (!deltas || deltas.length === 0) {
            return;
        }
        // Filter out already-processed deltas to prevent duplicates
        // This handles the race condition where useEffect runs multiple times
        // before the cursor state update commits
        const newDeltas = deltas.filter((d) => d.start >= lastProcessedEndRef.current);
        if (newDeltas.length === 0) {
            return;
        }
        // Find the highest end position and accumulate text from new deltas only
        let maxEnd = lastProcessedEndRef.current;
        let newText = "";
        for (const delta of newDeltas) {
            if (delta.end > maxEnd) {
                maxEnd = delta.end;
            }
            for (const part of delta.parts) {
                if (part.type === "text-delta" && part.text) {
                    newText += part.text;
                }
            }
        }
        if (newText) {
            setAccumulatedContent((prev) => prev + newText);
        }
        // Update ref immediately to prevent re-processing
        lastProcessedEndRef.current = maxEnd;
        // Update cursor state for next query
        if (maxEnd > cursor) {
            setCursor(maxEnd);
        }
    }, [deltas, cursor]);
    // Return null content when not streaming or no content
    const content = status === "streaming" && accumulatedContent.length > 0
        ? accumulatedContent
        : null;
    const isStreaming = status === "streaming";
    return { content, isStreaming, streamId, status };
}
// =============================================================================
// Hooks
// =============================================================================
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
export function useDatabaseChat(options) {
    const { conversationId, onMessageSent, onError, onAbort } = options;
    const { api } = useDatabaseChatContext();
    // Local state
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState(null);
    const [lastMessage, setLastMessage] = useState(null);
    // Refs for race condition handling
    const isMountedRef = useRef(true);
    const currentRequestRef = useRef(0);
    // Track if current request was aborted to ignore its result
    const wasAbortedRef = useRef(false);
    // Track mounted state for cleanup
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    // Server state via Convex reactive queries
    const messages = useQuery(api.getMessages, conversationId ? { conversationId } : "skip");
    // Use delta-based streaming with client-side accumulation
    const { content: streamingContent, isStreaming } = useStreamDeltaAccumulation({
        api,
        conversationId,
    });
    // Get the action and mutation
    const sendMessageAction = useAction(api.sendMessage);
    const abortStreamMutation = useMutation(api.abortStream);
    // Send message with race condition protection
    const send = useCallback(async (message) => {
        if (!conversationId) {
            const err = new Error("No conversation selected");
            setError(err);
            onError?.(err);
            return;
        }
        if (!message.trim()) {
            return;
        }
        // Increment request counter for race condition handling
        const requestId = ++currentRequestRef.current;
        wasAbortedRef.current = false;
        setIsLoading(true);
        setError(null);
        setLastMessage(message);
        try {
            const result = await sendMessageAction({
                conversationId,
                message: message.trim(),
            });
            // Check if this is still the current request, component is mounted, and not aborted
            if (requestId !== currentRequestRef.current ||
                !isMountedRef.current ||
                wasAbortedRef.current) {
                return;
            }
            if (!result.success) {
                // Don't show "Stream aborted" as an error - it's expected when user stops
                if (result.error && !result.error.toLowerCase().includes("aborted")) {
                    const err = new Error(result.error);
                    setError(err);
                    onError?.(err);
                }
            }
            else {
                setLastMessage(null);
                onMessageSent?.(result.content ?? "");
            }
        }
        catch (err) {
            // Check if this is still the current request, component is mounted, and not aborted
            if (requestId !== currentRequestRef.current ||
                !isMountedRef.current ||
                wasAbortedRef.current) {
                return;
            }
            const error = err instanceof Error ? err : new Error("Failed to send message");
            // Don't show abort-related errors
            if (!error.message.toLowerCase().includes("abort")) {
                setError(error);
                onError?.(error);
            }
        }
        finally {
            // Only update loading state if this is the current request and not aborted
            if (requestId === currentRequestRef.current &&
                isMountedRef.current &&
                !wasAbortedRef.current) {
                setIsLoading(false);
            }
        }
    }, [conversationId, sendMessageAction, onMessageSent, onError]);
    // Clear error
    const clearError = useCallback(() => {
        setError(null);
    }, []);
    // Retry last failed message
    const retry = useCallback(async () => {
        if (lastMessage) {
            await send(lastMessage);
        }
    }, [lastMessage, send]);
    // Abort the current stream
    const abort = useCallback(async () => {
        if (!conversationId) {
            return;
        }
        // Mark as aborted so send() ignores the result
        wasAbortedRef.current = true;
        try {
            await abortStreamMutation({
                conversationId,
                reason: "User cancelled",
            });
            onAbort?.();
        }
        catch (err) {
            console.warn("Failed to abort stream:", err);
        }
        finally {
            // Clear loading state since we're aborting
            setIsLoading(false);
        }
    }, [conversationId, abortStreamMutation, onAbort]);
    return {
        messages,
        streamingContent,
        isStreaming,
        isLoading,
        error,
        send,
        clearError,
        retry,
        abort,
    };
}
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
export function useConversations(options) {
    const { externalId } = options;
    const { api } = useDatabaseChatContext();
    const [isCreating, setIsCreating] = useState(false);
    const [error, setError] = useState(null);
    // Ref for mounted state
    const isMountedRef = useRef(true);
    useEffect(() => {
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    // Server state
    const conversations = useQuery(api.listConversations, { externalId });
    // Create conversation mutation
    const createConversationMutation = useMutation(api.createConversation);
    const create = useCallback(async (title) => {
        setIsCreating(true);
        setError(null);
        try {
            const conversationId = await createConversationMutation({
                externalId,
                title,
            });
            if (!isMountedRef.current) {
                return conversationId;
            }
            return conversationId;
        }
        catch (err) {
            if (!isMountedRef.current) {
                throw err;
            }
            const error = err instanceof Error
                ? err
                : new Error("Failed to create conversation");
            setError(error);
            throw error;
        }
        finally {
            if (isMountedRef.current) {
                setIsCreating(false);
            }
        }
    }, [externalId, createConversationMutation]);
    return {
        conversations,
        create,
        isCreating,
        error,
    };
}
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
export function useStreamingContent(options) {
    const { conversationId } = options;
    const { api } = useDatabaseChatContext();
    const { content, isStreaming } = useStreamDeltaAccumulation({
        api,
        conversationId,
    });
    return { content, isStreaming };
}
/**
 * Combine streaming content with completed messages for display.
 * Useful for rendering the full conversation including in-progress responses.
 */
export function useMessagesWithStreaming(options) {
    const { conversationId } = options;
    const { api } = useDatabaseChatContext();
    const messages = useQuery(api.getMessages, conversationId ? { conversationId } : "skip");
    const { content: streamingContent, isStreaming } = useStreamDeltaAccumulation({
        api,
        conversationId,
    });
    // Combine messages with streaming content
    const allMessages = useMemo(() => {
        const baseMessages = messages ?? [];
        if (isStreaming && streamingContent) {
            return [
                ...baseMessages,
                {
                    _id: "streaming",
                    role: "assistant",
                    content: streamingContent,
                },
            ];
        }
        return baseMessages;
    }, [messages, isStreaming, streamingContent]);
    return { allMessages, isStreaming };
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
export function useSmoothText(text, options = {}) {
    const { initialCharsPerSecond = 200, startStreaming = false, minDelayMs = 10, maxDelayMs = 100, } = options;
    const [visibleText, setVisibleText] = useState("");
    const [isAnimating, setIsAnimating] = useState(false);
    // Refs for tracking state across renders
    const targetTextRef = useRef(text ?? "");
    const visibleLengthRef = useRef(0);
    const lastUpdateTimeRef = useRef(Date.now());
    const charsPerSecondRef = useRef(initialCharsPerSecond);
    const hasStartedRef = useRef(false);
    const animationFrameRef = useRef(null);
    // Update target text when prop changes
    useEffect(() => {
        targetTextRef.current = text ?? "";
    }, [text]);
    // Main animation effect
    useEffect(() => {
        const targetText = text ?? "";
        // If we haven't started and startStreaming is false, show full text immediately
        if (!hasStartedRef.current && !startStreaming) {
            setVisibleText(targetText);
            visibleLengthRef.current = targetText.length;
            return;
        }
        // Mark that we've started
        if (startStreaming && !hasStartedRef.current) {
            hasStartedRef.current = true;
        }
        // If visible text is already at target, nothing to do
        if (visibleLengthRef.current >= targetText.length) {
            setIsAnimating(false);
            return;
        }
        setIsAnimating(true);
        const animate = () => {
            const now = Date.now();
            const elapsed = now - lastUpdateTimeRef.current;
            const target = targetTextRef.current;
            // Calculate how many characters to show based on elapsed time
            const charsToAdd = Math.max(1, Math.floor((elapsed / 1000) * charsPerSecondRef.current));
            if (visibleLengthRef.current < target.length) {
                const newLength = Math.min(visibleLengthRef.current + charsToAdd, target.length);
                // Adapt speed based on how fast text is arriving
                if (newLength < target.length) {
                    // We're behind, speed up
                    charsPerSecondRef.current = Math.min(charsPerSecondRef.current * 1.1, 1000);
                }
                else if (target.length - visibleLengthRef.current < 10) {
                    // We're catching up, slow down slightly
                    charsPerSecondRef.current = Math.max(charsPerSecondRef.current * 0.95, initialCharsPerSecond / 2);
                }
                visibleLengthRef.current = newLength;
                setVisibleText(target.slice(0, newLength));
                lastUpdateTimeRef.current = now;
                // Calculate delay for next frame
                const delay = Math.max(minDelayMs, Math.min(maxDelayMs, 1000 / charsPerSecondRef.current));
                animationFrameRef.current = window.setTimeout(animate, delay);
            }
            else {
                setIsAnimating(false);
            }
        };
        // Start animation
        lastUpdateTimeRef.current = Date.now();
        animationFrameRef.current = window.setTimeout(animate, minDelayMs);
        return () => {
            if (animationFrameRef.current !== null) {
                clearTimeout(animationFrameRef.current);
                animationFrameRef.current = null;
            }
        };
    }, [text, startStreaming, initialCharsPerSecond, minDelayMs, maxDelayMs]);
    // Reset when text is cleared
    useEffect(() => {
        if (!text) {
            setVisibleText("");
            visibleLengthRef.current = 0;
            hasStartedRef.current = false;
            charsPerSecondRef.current = initialCharsPerSecond;
        }
    }, [text, initialCharsPerSecond]);
    return [visibleText, isAnimating];
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
export function SmoothText({ text, className, ...options }) {
    const [visibleText] = useSmoothText(text, options);
    return _jsx("span", { className: className, children: visibleText });
}
