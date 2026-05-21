/**
 * Add a message to a conversation
 */
export declare const add: import("convex/server").RegisteredMutation<"public", {
    toolCalls?: {
        id: string;
        name: string;
        arguments: string;
    }[] | undefined;
    toolResults?: {
        toolCallId: string;
        result: string;
    }[] | undefined;
    conversationId: import("convex/values").GenericId<"conversations">;
    content: string;
    role: "user" | "assistant" | "tool";
}, Promise<import("convex/values").GenericId<"messages">>>;
/**
 * List messages in a conversation (oldest first for chat display).
 * Returns the most recent `limit` messages, bounded to prevent unbounded queries.
 */
export declare const list: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    conversationId: import("convex/values").GenericId<"conversations">;
}, Promise<any>>;
/**
 * List messages in a conversation scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const listForExternalId: import("convex/server").RegisteredQuery<"public", {
    limit?: number | undefined;
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
}, Promise<any>>;
/**
 * Get the latest message in a conversation
 */
export declare const getLatest: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
}, Promise<any>>;
/**
 * Get the latest message in a conversation scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const getLatestForExternalId: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
}, Promise<any>>;
//# sourceMappingURL=messages.d.ts.map