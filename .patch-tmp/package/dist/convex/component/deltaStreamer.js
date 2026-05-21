const DEFAULT_THROTTLE_MS = 100;
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
export class DeltaStreamer {
    constructor(ctx, component, conversationId, config = {}) {
        this.ctx = ctx;
        this.component = component;
        this.conversationId = conversationId;
        this.nextParts = [];
        this.cursor = 0;
        this.latestWrite = 0;
        this.throttleMs = config.throttleMs ?? DEFAULT_THROTTLE_MS;
        this.onAbort = config.onAbort;
        this.abortController = new AbortController();
    }
    /**
     * Get the stream ID, creating the stream if needed.
     * Safe to call multiple times - will only create once.
     */
    async getStreamId() {
        if (this.streamId) {
            return this.streamId;
        }
        if (this.creatingStreamPromise) {
            return this.creatingStreamPromise;
        }
        this.creatingStreamPromise = this.ctx.runMutation(this.component.stream.create, { conversationId: this.conversationId });
        this.streamId = await this.creatingStreamPromise;
        return this.streamId;
    }
    /**
     * Add parts to the stream. Parts are batched and written according to throttleMs.
     */
    async addParts(parts) {
        if (this.abortController.signal.aborted) {
            return;
        }
        await this.getStreamId();
        this.nextParts.push(...parts);
        // Write immediately if enough time has passed since last write
        if (!this.ongoingWrite &&
            Date.now() - this.latestWrite >= this.throttleMs) {
            this.ongoingWrite = this.sendDelta();
        }
    }
    /**
     * Consume an async iterable stream, converting each chunk to a text-delta part.
     */
    async consumeTextStream(stream) {
        for await (const chunk of stream) {
            if (this.abortController.signal.aborted) {
                break;
            }
            await this.addParts([{ type: "text-delta", text: chunk }]);
        }
        if (!this.abortController.signal.aborted) {
            await this.finish();
        }
    }
    /**
     * Consume an async iterable of StreamParts directly.
     */
    async consumeStream(stream) {
        for await (const part of stream) {
            if (this.abortController.signal.aborted) {
                break;
            }
            await this.addParts([part]);
        }
        if (!this.abortController.signal.aborted) {
            await this.finish();
        }
    }
    /**
     * Finish the stream successfully. Flushes any remaining parts.
     */
    async finish() {
        if (!this.streamId) {
            return;
        }
        // Wait for any ongoing write
        await this.ongoingWrite;
        // Flush remaining parts
        await this.sendDelta();
        // Mark stream as finished (this also deletes deltas)
        await this.ctx.runMutation(this.component.stream.finish, {
            streamId: this.streamId,
        });
    }
    /**
     * Abort the stream with a reason.
     */
    async fail(reason) {
        if (this.abortController.signal.aborted) {
            return;
        }
        this.abortController.abort();
        if (!this.streamId) {
            return;
        }
        // Wait for any ongoing write
        await this.ongoingWrite;
        // Mark stream as aborted
        await this.ctx.runMutation(this.component.stream.abort, {
            streamId: this.streamId,
            reason,
        });
        if (this.onAbort) {
            await this.onAbort(reason);
        }
    }
    /**
     * Send accumulated parts as a delta to the database.
     */
    async sendDelta() {
        if (this.abortController.signal.aborted) {
            this.ongoingWrite = undefined;
            return;
        }
        const delta = this.createDelta();
        if (!delta) {
            this.ongoingWrite = undefined;
            return;
        }
        this.latestWrite = Date.now();
        try {
            const success = await this.ctx.runMutation(this.component.stream.addDelta, delta);
            if (!success) {
                // Stream was aborted externally
                this.abortController.abort();
                if (this.onAbort) {
                    await this.onAbort("Stream aborted externally");
                }
                this.ongoingWrite = undefined;
                return;
            }
        }
        catch (e) {
            // Error writing delta - abort the stream
            this.abortController.abort();
            if (this.onAbort) {
                await this.onAbort(e instanceof Error ? e.message : "Unknown error");
            }
            this.ongoingWrite = undefined;
            throw e;
        }
        // Check if we need to send another delta
        if (this.nextParts.length > 0 &&
            Date.now() - this.latestWrite >= this.throttleMs) {
            this.ongoingWrite = this.sendDelta();
        }
        else {
            this.ongoingWrite = undefined;
        }
    }
    /**
     * Create a delta from accumulated parts.
     */
    createDelta() {
        if (this.nextParts.length === 0) {
            return undefined;
        }
        // Check streamId BEFORE mutating state to avoid data loss
        if (!this.streamId) {
            throw new Error("Creating delta before stream is created");
        }
        const start = this.cursor;
        const end = start + this.nextParts.length;
        this.cursor = end;
        // Compress consecutive text deltas
        const parts = this.compressParts(this.nextParts);
        this.nextParts = [];
        return { streamId: this.streamId, start, end, parts };
    }
    /**
     * Compress consecutive text-delta parts into single parts.
     * E.g., [{type: "text-delta", text: "a"}, {type: "text-delta", text: "b"}]
     * becomes [{type: "text-delta", text: "ab"}]
     */
    compressParts(parts) {
        const compressed = [];
        for (const part of parts) {
            const last = compressed.length > 0 ? compressed[compressed.length - 1] : undefined;
            if (part.type === "text-delta" && last?.type === "text-delta") {
                // Combine consecutive text deltas
                last.text = (last.text ?? "") + (part.text ?? "");
            }
            else {
                compressed.push({ ...part });
            }
        }
        return compressed;
    }
}
