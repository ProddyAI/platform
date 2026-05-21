/**
 * Send a message and get a streaming response.
 * This is the core chat action that orchestrates the LLM call.
 *
 * Supports tool calling: when tools are provided, the LLM can request
 * to call them, and this action will execute them and return results.
 */
export declare const send: import("convex/server").RegisteredAction<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    message: string;
    config: {
        tools?: {
            handlerType?: "query" | "mutation" | "action" | undefined;
            name: string;
            parameters: {
                required?: string[] | undefined;
                type: "object";
                properties: any;
            };
            handler: string;
            description: string;
        }[] | undefined;
        model?: string | undefined;
        systemPrompt?: string | undefined;
        maxMessagesForLLM?: number | undefined;
        toolContext?: any;
        apiKey: string;
    };
}, Promise<{
    success: boolean;
    content: string;
    toolCalls: {
        name: string;
        args: unknown;
        result: unknown;
    }[] | undefined;
    error?: undefined;
} | {
    success: boolean;
    error: string;
    content?: undefined;
    toolCalls?: undefined;
}>>;
/**
 * Send a message scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const sendForExternalId: import("convex/server").RegisteredAction<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
    message: string;
    config: {
        tools?: {
            handlerType?: "query" | "mutation" | "action" | undefined;
            name: string;
            parameters: {
                required?: string[] | undefined;
                type: "object";
                properties: any;
            };
            handler: string;
            description: string;
        }[] | undefined;
        model?: string | undefined;
        systemPrompt?: string | undefined;
        maxMessagesForLLM?: number | undefined;
        toolContext?: any;
        apiKey: string;
    };
}, Promise<{
    success: boolean;
    content: string;
    toolCalls: {
        name: string;
        args: unknown;
        result: unknown;
    }[] | undefined;
    error?: undefined;
} | {
    success: boolean;
    error: string;
    content?: undefined;
    toolCalls?: undefined;
}>>;
//# sourceMappingURL=chat.d.ts.map