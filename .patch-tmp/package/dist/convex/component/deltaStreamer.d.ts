import type { GenericActionCtx } from "convex/server";
import type { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
/**
 * A part of the stream - matches AI SDK's UIMessageChunk format for compatibility
 */
export interface StreamPart {
    type: "text-delta" | "tool-call" | "tool-result" | "error";
    text?: string;
    toolCallId?: string;
    toolName?: string;
    args?: string;
    result?: string;
    error?: string;
}
/**
 * Configuration for the DeltaStreamer
 */
export interface DeltaStreamerConfig {
    /** Minimum ms between delta writes (default: 100) */
    throttleMs?: number;
    /** Called when stream is aborted asynchronously */
    onAbort?: (reason: string) => Promise<void>;
}
/**
 * DeltaStreamer batches streaming parts and writes them as deltas to the database.
 * This provides O(n) bandwidth instead of O(n²) when streaming.
 *
 * Usage:
 * ```typescript
 * const streamer = new DeltaStreamer(ctx, api, conversationId, { throttleMs: 100 });
 *
 * // Option 1: Consume an async iterable
 * await streamer.consumeStream(textStream);
 *
 * // Option 2: Add parts manually
 * await streamer.addParts([{ type: "text-delta", text: "Hello" }]);
 * await streamer.finish();
 * ```
 */
export declare class DeltaStreamer {
    private ctx;
    private component;
    private conversationId;
    private streamId;
    private creatingStreamPromise;
    private nextParts;
    private cursor;
    private latestWrite;
    private ongoingWrite;
    private throttleMs;
    private onAbort?;
    readonly abortController: AbortController;
    constructor(ctx: GenericActionCtx<any>, component: typeof api, conversationId: Id<"conversations">, config?: DeltaStreamerConfig);
    /**
     * Get the stream ID, creating the stream if needed.
     * Safe to call multiple times - will only create once.
     */
    getStreamId(): Promise<Id<"streamingMessages">>;
    /**
     * Add parts to the stream. Parts are batched and written according to throttleMs.
     */
    addParts(parts: StreamPart[]): Promise<void>;
    /**
     * Consume an async iterable stream, converting each chunk to a text-delta part.
     */
    consumeTextStream(stream: AsyncIterable<string>): Promise<void>;
    /**
     * Consume an async iterable of StreamParts directly.
     */
    consumeStream(stream: AsyncIterable<StreamPart>): Promise<void>;
    /**
     * Finish the stream successfully. Flushes any remaining parts.
     */
    finish(): Promise<void>;
    /**
     * Abort the stream with a reason.
     */
    fail(reason: string): Promise<void>;
    /**
     * Send accumulated parts as a delta to the database.
     */
    private sendDelta;
    /**
     * Create a delta from accumulated parts.
     */
    private createDelta;
    /**
     * Compress consecutive text-delta parts into single parts.
     * E.g., [{type: "text-delta", text: "a"}, {type: "text-delta", text: "b"}]
     * becomes [{type: "text-delta", text: "ab"}]
     */
    private compressParts;
}
//# sourceMappingURL=deltaStreamer.d.ts.map