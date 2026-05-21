/**
 * Client wrapper for the DatabaseChat component.
 *
 * Apps use this to interact with the component in a type-safe way.
 *
 * ## Setup (in your app's convex/ folder)
 *
 * ```typescript
 * // convex/chat.ts
 * import { v } from "convex/values";
 * import { action, mutation, query } from "./_generated/server";
 * import { components } from "./_generated/api";
 * import { defineDatabaseChat } from "./components/databaseChat/client";
 *
 * // Initialize with default config
 * const chat = defineDatabaseChat(components.databaseChat, {
 *   model: "anthropic/claude-sonnet-4",
 *   systemPrompt: "You are a helpful assistant.",
 * });
 *
 * // Create conversation
 * export const createConversation = mutation({
 *   args: { title: v.optional(v.string()) },
 *   handler: async (ctx, args) => {
 *     const userId = await getAuthUserId(ctx); // Your auth
 *     return await chat.createConversation(ctx, {
 *       externalId: `user:${userId}`,
 *       title: args.title,
 *     });
 *   },
 * });
 *
 * // Get messages
 * export const getMessages = query({
 *   args: { conversationId: v.string() },
 *   handler: async (ctx, args) => {
 *     return await chat.getMessages(ctx, args.conversationId);
 *   },
 * });
 *
 * // Send message (action because it calls external API)
 * export const sendMessage = action({
 *   args: { conversationId: v.string(), message: v.string() },
 *   handler: async (ctx, args) => {
 *     return await chat.send(ctx, {
 *       conversationId: args.conversationId,
 *       message: args.message,
 *       apiKey: process.env.OPENROUTER_API_KEY!, // From app env
 *     });
 *   },
 * });
 *
 * // Get stream state (for real-time UI)
 * export const getStreamState = query({
 *   args: { conversationId: v.string() },
 *   handler: async (ctx, args) => {
 *     return await chat.getStreamState(ctx, args.conversationId);
 *   },
 * });
 *
 * // Get stream deltas (for efficient delta-based streaming)
 * export const getStreamDeltas = query({
 *   args: { streamId: v.string(), cursor: v.number() },
 *   handler: async (ctx, args) => {
 *     return await chat.getStreamDeltas(ctx, args.streamId, args.cursor);
 *   },
 * });
 * ```
 *
 * ## Advanced: Using your own LLM SDK (Vercel AI, OpenAI, etc.)
 *
 * For custom LLM integrations, use the DeltaStreamer class from the component.
 * See the component's chat.ts for an example of delta-based streaming.
 */
import type { GenericActionCtx, GenericMutationCtx, GenericQueryCtx } from "convex/server";
import type { api } from "./_generated/api";
import type { DatabaseChatTool, AutoToolsConfig } from "./tools";
import type { TableInfo, SchemaToolHandlers } from "./schemaTools";
import { formatToolsForLLM } from "./tools";
type ComponentApi = typeof api;
type QueryCtx = GenericQueryCtx<any>;
type MutationCtx = GenericMutationCtx<any>;
type ActionCtx = GenericActionCtx<any>;
export interface DatabaseChatConfig {
    /** Default model to use (default: "openai/gpt-4o") */
    model?: string;
    /** Default system prompt */
    systemPrompt?: string;
    /**
     * Explicit tool definitions.
     * Use this for precise control over what queries the LLM can run.
     */
    tools?: DatabaseChatTool[];
    /**
     * Auto-generate tools from schema.
     * Provide table info and handlers to automatically create query tools.
     */
    autoTools?: {
        /** Table information (use defineTable helper or extract from schema) */
        tables: TableInfo[];
        /** Function handle strings for each tool type */
        handlers: SchemaToolHandlers;
    } & AutoToolsConfig;
    /**
     * Maximum messages to fetch for display (default: 100).
     * Fetches the most recent N messages to prevent unbounded queries.
     */
    maxMessagesForDisplay?: number;
    /**
     * Maximum messages to include in LLM context (default: 50).
     * Uses the most recent N messages for conversation history.
     */
    maxMessagesForLLM?: number;
}
export interface SendMessageOptions {
    conversationId: string;
    message: string;
    /** OpenRouter API key (required - get from process.env in your app) */
    apiKey: string;
    /** Override model for this message */
    model?: string;
    /** Override system prompt for this message */
    systemPrompt?: string;
    /** Server-side context merged into tool args (not exposed to LLM) */
    toolContext?: Record<string, unknown>;
}
export interface SendMessageResult {
    success: boolean;
    content?: string;
    error?: string;
    /** Tool calls that were executed (for debugging/logging) */
    toolCalls?: Array<{
        name: string;
        args: unknown;
        result: unknown;
    }>;
}
/**
 * Client for interacting with the DatabaseChat component.
 */
export declare class DatabaseChatClient {
    private component;
    private config;
    private tools;
    constructor(component: ComponentApi, config?: DatabaseChatConfig);
    /**
     * Initialize tools from config (explicit + auto-generated).
     */
    private initializeTools;
    /**
     * Get all configured tools.
     */
    getTools(): DatabaseChatTool[];
    /**
     * Get tools formatted for LLM API (OpenAI function calling format).
     */
    getToolsForLLM(): {
        type: "function";
        function: {
            name: string;
            description: string;
            parameters: import("./tools").ToolParameterSchema;
        };
    }[];
    /**
     * Find a tool by name.
     */
    findTool(name: string): DatabaseChatTool | undefined;
    /**
     * Execute a tool by calling the function handle.
     * This is called by the chat action when the LLM requests a tool.
     */
    executeTool(ctx: ActionCtx, toolName: string, args: Record<string, unknown>): Promise<{
        success: boolean;
        result?: unknown;
        error?: string;
    }>;
    /**
     * Check if any tools are configured.
     */
    hasTools(): boolean;
    /**
     * Create a new conversation.
     */
    createConversation(ctx: MutationCtx, options: {
        externalId: string;
        title?: string;
    }): Promise<string>;
    /**
     * Get a conversation by ID.
     */
    getConversation(ctx: QueryCtx, conversationId: string): Promise<{
        _id: import("convex/values").GenericId<"conversations">;
        _creationTime: number;
        title?: string | undefined;
        externalId: string;
        createdAt: number;
        updatedAt: number;
    } | null>;
    /**
     * List conversations for an external ID (e.g., user ID).
     */
    listConversations(ctx: QueryCtx, externalId: string): Promise<{
        _id: import("convex/values").GenericId<"conversations">;
        _creationTime: number;
        title?: string | undefined;
        externalId: string;
        createdAt: number;
        updatedAt: number;
    }[]>;
    /**
     * Get messages in a conversation.
     * Returns the most recent messages, bounded by maxMessagesForDisplay config (default: 100).
     */
    getMessages(ctx: QueryCtx, conversationId: string): Promise<any>;
    /**
     * Get the current stream state for a conversation.
     * Use this to check if streaming is active and get the stream ID.
     */
    getStreamState(ctx: QueryCtx, conversationId: string): Promise<{
        streamId: any;
        status: any;
        startedAt: any;
        endedAt: any;
        abortReason: any;
    } | null>;
    /**
     * Get stream deltas from a cursor position.
     * Use with getStreamState to efficiently fetch streaming content.
     *
     * @example
     * ```typescript
     * const state = await chat.getStreamState(ctx, conversationId);
     * if (state?.status === 'streaming') {
     *   const deltas = await chat.getStreamDeltas(ctx, state.streamId, cursor);
     *   // Accumulate text from deltas client-side
     * }
     * ```
     */
    getStreamDeltas(ctx: QueryCtx, streamId: string, cursor: number): Promise<any>;
    /**
     * Abort an active stream for a conversation.
     * Call this when the user wants to stop generation.
     */
    abortStream(ctx: MutationCtx, conversationId: string, reason?: string): Promise<boolean>;
    /**
     * Send a message and get a streaming response.
     * This is the simple path - uses OpenRouter internally.
     *
     * If tools are configured (via explicit tools or autoTools), they will
     * automatically be included in the LLM call.
     */
    send(ctx: ActionCtx, options: SendMessageOptions): Promise<SendMessageResult>;
    /**
     * Add a message to a conversation.
     * Use this when bringing your own LLM SDK.
     *
     * @example
     * ```typescript
     * // Save user message
     * await chat.addMessage(ctx, conversationId, "user", userInput);
     *
     * // Call your LLM (Vercel AI SDK, OpenAI, etc.)
     * const response = await yourLLMCall(...);
     *
     * // Save assistant response
     * await chat.addMessage(ctx, conversationId, "assistant", response);
     * ```
     */
    addMessage(ctx: MutationCtx, conversationId: string, role: "user" | "assistant" | "tool", content: string, options?: {
        toolCalls?: Array<{
            id: string;
            name: string;
            arguments: string;
        }>;
        toolResults?: Array<{
            toolCallId: string;
            result: string;
        }>;
    }): Promise<string>;
    /**
     * Get messages formatted for LLM API calls.
     * Returns messages in the format expected by most LLM APIs.
     * Uses maxMessagesForLLM config to limit context (default: 50).
     *
     * @example
     * ```typescript
     * const messages = await chat.getMessagesForLLM(ctx, conversationId, {
     *   systemPrompt: "You are a helpful assistant.",
     * });
     * // Returns: [{ role: "system", content: "..." }, { role: "user", content: "..." }, ...]
     * ```
     */
    getMessagesForLLM(ctx: QueryCtx, conversationId: string, options?: {
        systemPrompt?: string;
        includeTools?: boolean;
    }): Promise<{
        messages: Array<{
            role: string;
            content: string;
        }>;
        tools?: ReturnType<typeof formatToolsForLLM>;
    }>;
    /**
     * Build the system prompt with optional tool descriptions.
     */
    getSystemPromptWithTools(basePrompt?: string): string;
}
/**
 * Helper function to create a DatabaseChatClient.
 *
 * Usage:
 * ```typescript
 * const chat = defineDatabaseChat(components.databaseChat, {
 *   model: "anthropic/claude-sonnet-4",
 *   systemPrompt: "You are a helpful assistant.",
 * });
 * ```
 */
export declare function defineDatabaseChat(component: ComponentApi, config?: DatabaseChatConfig): DatabaseChatClient;
export {};
//# sourceMappingURL=client.d.ts.map