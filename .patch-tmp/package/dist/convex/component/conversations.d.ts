/**
 * Create a new conversation
 */
export declare const create: import("convex/server").RegisteredMutation<"public", {
    title?: string | undefined;
    externalId: string;
}, Promise<import("convex/values").GenericId<"conversations">>>;
/**
 * Get a conversation by ID
 */
export declare const get: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
    title?: string | undefined;
    externalId: string;
    createdAt: number;
    updatedAt: number;
} | null>>;
/**
 * Get a conversation by ID, scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const getForExternalId: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
}, Promise<any>>;
/**
 * List conversations for an external ID (e.g., user)
 */
export declare const list: import("convex/server").RegisteredQuery<"public", {
    externalId: string;
}, Promise<{
    _id: import("convex/values").GenericId<"conversations">;
    _creationTime: number;
    title?: string | undefined;
    externalId: string;
    createdAt: number;
    updatedAt: number;
}[]>>;
//# sourceMappingURL=conversations.d.ts.map