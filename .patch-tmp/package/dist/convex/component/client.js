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
import { generateToolsFromSchema } from "./schemaTools";
import { formatToolsForLLM, findTool, validateToolArgs } from "./tools";
/**
 * Client for interacting with the DatabaseChat component.
 */
export class DatabaseChatClient {
    constructor(component, config = {}) {
        this.component = component;
        this.config = config;
        // Combine explicit tools with auto-generated tools
        this.tools = this.initializeTools();
    }
    /**
     * Initialize tools from config (explicit + auto-generated).
     */
    initializeTools() {
        const allTools = [];
        // Add explicit tools
        if (this.config.tools) {
            allTools.push(...this.config.tools);
        }
        // Add auto-generated tools from schema
        if (this.config.autoTools) {
            const { tables, handlers, ...autoConfig } = this.config.autoTools;
            const autoTools = generateToolsFromSchema({
                tables,
                handlers,
                ...autoConfig,
            });
            allTools.push(...autoTools);
        }
        return allTools;
    }
    /**
     * Get all configured tools.
     */
    getTools() {
        return this.tools;
    }
    /**
     * Get tools formatted for LLM API (OpenAI function calling format).
     */
    getToolsForLLM() {
        return formatToolsForLLM(this.tools);
    }
    /**
     * Find a tool by name.
     */
    findTool(name) {
        return findTool(this.tools, name);
    }
    /**
     * Execute a tool by calling the function handle.
     * This is called by the chat action when the LLM requests a tool.
     */
    async executeTool(ctx, toolName, args) {
        const tool = this.findTool(toolName);
        if (!tool) {
            return { success: false, error: `Unknown tool: ${toolName}` };
        }
        // Validate arguments
        const validationError = validateToolArgs(tool, args);
        if (validationError) {
            return { success: false, error: validationError };
        }
        try {
            const result = await executeToolHandler(ctx, tool, args);
            return { success: true, result };
        }
        catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : "Tool execution failed",
            };
        }
    }
    /**
     * Check if any tools are configured.
     */
    hasTools() {
        return this.tools.length > 0;
    }
    /**
     * Create a new conversation.
     */
    async createConversation(ctx, options) {
        return await ctx.runMutation(this.component.conversations.create, options);
    }
    /**
     * Get a conversation by ID.
     */
    async getConversation(ctx, conversationId) {
        return await ctx.runQuery(this.component.conversations.get, {
            conversationId: conversationId,
        });
    }
    /**
     * List conversations for an external ID (e.g., user ID).
     */
    async listConversations(ctx, externalId) {
        return await ctx.runQuery(this.component.conversations.list, {
            externalId,
        });
    }
    /**
     * Get messages in a conversation.
     * Returns the most recent messages, bounded by maxMessagesForDisplay config (default: 100).
     */
    async getMessages(ctx, conversationId) {
        return await ctx.runQuery(this.component.messages.list, {
            conversationId: conversationId,
            limit: this.config.maxMessagesForDisplay ?? 100,
        });
    }
    /**
     * Get the current stream state for a conversation.
     * Use this to check if streaming is active and get the stream ID.
     */
    async getStreamState(ctx, conversationId) {
        return await ctx.runQuery(this.component.stream.getStream, {
            conversationId: conversationId,
        });
    }
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
    async getStreamDeltas(ctx, streamId, cursor) {
        return await ctx.runQuery(this.component.stream.listDeltas, {
            streamId: streamId,
            cursor,
        });
    }
    /**
     * Abort an active stream for a conversation.
     * Call this when the user wants to stop generation.
     */
    async abortStream(ctx, conversationId, reason = "User cancelled") {
        return await ctx.runMutation(this.component.stream.abortByConversation, {
            conversationId: conversationId,
            reason,
        });
    }
    /**
     * Send a message and get a streaming response.
     * This is the simple path - uses OpenRouter internally.
     *
     * If tools are configured (via explicit tools or autoTools), they will
     * automatically be included in the LLM call.
     */
    async send(ctx, options) {
        return await ctx.runAction(this.component.chat.send, {
            conversationId: options.conversationId,
            message: options.message,
            config: {
                apiKey: options.apiKey,
                model: options.model ?? this.config.model,
                systemPrompt: options.systemPrompt ?? this.config.systemPrompt,
                tools: this.tools.length > 0 ? this.tools : undefined,
                maxMessagesForLLM: this.config.maxMessagesForLLM ?? 50,
                toolContext: options.toolContext,
            },
        });
    }
    // ===========================================================================
    // Advanced: Lower-level primitives for custom LLM integrations
    // Use these if you want to use Vercel AI SDK, direct OpenAI, etc.
    // ===========================================================================
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
    async addMessage(ctx, conversationId, role, content, options) {
        return await ctx.runMutation(this.component.messages.add, {
            conversationId: conversationId,
            role,
            content,
            toolCalls: options?.toolCalls,
            toolResults: options?.toolResults,
        });
    }
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
    async getMessagesForLLM(ctx, conversationId, options) {
        // Use LLM-specific limit for context window efficiency
        const messages = await ctx.runQuery(this.component.messages.list, {
            conversationId: conversationId,
            limit: this.config.maxMessagesForLLM ?? 50,
        });
        const formatted = [];
        // Build system prompt with tool descriptions if tools are configured
        let systemPrompt = options?.systemPrompt ?? this.config.systemPrompt ?? "";
        if (this.hasTools() && options?.includeTools !== false) {
            const toolDescriptions = this.tools
                .map((t) => `- ${t.name}: ${t.description}`)
                .join("\n");
            systemPrompt += systemPrompt
                ? `\n\nYou have access to the following tools to query the database:\n${toolDescriptions}`
                : `You have access to the following tools to query the database:\n${toolDescriptions}`;
        }
        if (systemPrompt) {
            formatted.push({ role: "system", content: systemPrompt });
        }
        // Add conversation messages
        for (const msg of messages) {
            if (msg.role === "user" || msg.role === "assistant") {
                formatted.push({ role: msg.role, content: msg.content });
            }
            // Handle tool messages
            if (msg.role === "tool" && msg.toolResults) {
                for (const result of msg.toolResults) {
                    formatted.push({
                        role: "tool",
                        content: result.result,
                    });
                }
            }
        }
        const result = { messages: formatted };
        // Include tools if configured and requested
        if (this.hasTools() && options?.includeTools !== false) {
            result.tools = this.getToolsForLLM();
        }
        return result;
    }
    /**
     * Build the system prompt with optional tool descriptions.
     */
    getSystemPromptWithTools(basePrompt) {
        const prompt = basePrompt ?? this.config.systemPrompt ?? "";
        if (!this.hasTools()) {
            return prompt;
        }
        const toolDescriptions = this.tools
            .map((t) => `- ${t.name}: ${t.description}`)
            .join("\n");
        return prompt
            ? `${prompt}\n\nYou have access to the following tools to query the database:\n${toolDescriptions}`
            : `You have access to the following tools to query the database:\n${toolDescriptions}`;
    }
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
export function defineDatabaseChat(component, config = {}) {
    return new DatabaseChatClient(component, config);
}
async function executeToolHandler(ctx, tool, args) {
    const handlerType = tool.handlerType ?? "query";
    switch (handlerType) {
        case "mutation":
            return await ctx.runMutation(tool.handler, args);
        case "action":
            return await ctx.runAction(tool.handler, args);
        case "query":
        default:
            return await ctx.runQuery(tool.handler, args);
    }
}
