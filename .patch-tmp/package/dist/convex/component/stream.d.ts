/**
 * Create a new stream for a conversation.
 * Called when starting to stream a response.
 */
export declare const create: import("convex/server").RegisteredMutation<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
}, Promise<import("convex/values").GenericId<"streamingMessages">>>;
/**
 * Add a delta (batch of parts) to a stream.
 * Called periodically by DeltaStreamer as tokens arrive.
 * Returns false if stream was aborted (signals caller to stop).
 */
export declare const addDelta: import("convex/server").RegisteredMutation<"public", {
    streamId: import("convex/values").GenericId<"streamingMessages">;
    start: number;
    end: number;
    parts: {
        error?: string | undefined;
        text?: string | undefined;
        toolCallId?: string | undefined;
        result?: string | undefined;
        toolName?: string | undefined;
        args?: string | undefined;
        type: "text-delta" | "tool-call" | "tool-result" | "error";
    }[];
}, Promise<boolean>>;
/**
 * Mark a stream as finished and clean up deltas.
 * Called when streaming completes successfully.
 */
export declare const finish: import("convex/server").RegisteredMutation<"public", {
    streamId: import("convex/values").GenericId<"streamingMessages">;
}, Promise<null>>;
/**
 * Abort a stream.
 * Called when generation is cancelled or fails.
 */
export declare const abort: import("convex/server").RegisteredMutation<"public", {
    streamId: import("convex/values").GenericId<"streamingMessages">;
    reason: string;
}, Promise<null>>;
/**
 * Abort a stream by conversation ID.
 * Used when client wants to stop generation.
 */
export declare const abortByConversation: import("convex/server").RegisteredMutation<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    reason: string;
}, Promise<boolean>>;
/**
 * Abort a stream by conversation ID, scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const abortForExternalId: import("convex/server").RegisteredMutation<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
    reason: string;
}, Promise<boolean>>;
/**
 * Get the current stream state for a conversation.
 * Clients subscribe to this to know when streaming starts/stops.
 * Prioritizes active "streaming" status, falls back to most recent.
 */
export declare const getStream: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
}, Promise<{
    streamId: any;
    status: any;
    startedAt: any;
    endedAt: any;
    abortReason: any;
} | null>>;
/**
 * Get the current stream state for a conversation scoped to externalId.
 * Throws "Not found" if the conversation is missing or not owned by externalId.
 */
export declare const getStreamForExternalId: import("convex/server").RegisteredQuery<"public", {
    conversationId: import("convex/values").GenericId<"conversations">;
    externalId: string;
}, Promise<{
    streamId: any;
    status: any;
    startedAt: any;
    endedAt: any;
    abortReason: any;
} | null>>;
/**
 * List deltas for a stream from a given cursor position.
 * Clients call this to get new deltas since their last fetch.
 */
export declare const listDeltas: import("convex/server").RegisteredQuery<"public", {
    cursor: number;
    streamId: import("convex/values").GenericId<"streamingMessages">;
}, Promise<any>>;
/**
 * List deltas for a stream scoped to externalId.
 * Throws "Not found" if the stream is missing or not owned by externalId.
 */
export declare const listDeltasForExternalId: import("convex/server").RegisteredQuery<"public", {
    cursor: number;
    streamId: import("convex/values").GenericId<"streamingMessages">;
    externalId: string;
}, Promise<any>>;
/**
 * Internal: Handle stream timeout.
 * Called by scheduler if no heartbeat received.
 */
export declare const timeoutStream: import("convex/server").RegisteredMutation<"internal", {
    streamId: import("convex/values").GenericId<"streamingMessages">;
}, Promise<null>>;
/**
 * Internal: Clean up a finished/aborted stream record.
 * Called after a delay to give clients time to observe final status.
 * Also cleans up any remaining deltas that weren't deleted in the initial pass.
 */
export declare const cleanupStream: import("convex/server").RegisteredMutation<"internal", {
    streamId: import("convex/values").GenericId<"streamingMessages">;
}, Promise<null>>;
//# sourceMappingURL=stream.d.ts.map