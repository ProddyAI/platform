declare const _default: import("convex/server").SchemaDefinition<{
    conversations: import("convex/server").TableDefinition<import("convex/values").VObject<{
        title?: string | undefined;
        externalId: string;
        createdAt: number;
        updatedAt: number;
    }, {
        externalId: import("convex/values").VString<string, "required">;
        title: import("convex/values").VString<string | undefined, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
        updatedAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "externalId" | "title" | "createdAt" | "updatedAt">, {
        by_external_id: ["externalId", "_creationTime"];
    }, {}, {}>;
    messages: import("convex/server").TableDefinition<import("convex/values").VObject<{
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
        createdAt: number;
        role: "user" | "assistant" | "tool";
    }, {
        conversationId: import("convex/values").VId<import("convex/values").GenericId<"conversations">, "required">;
        role: import("convex/values").VUnion<"user" | "assistant" | "tool", [import("convex/values").VLiteral<"user", "required">, import("convex/values").VLiteral<"assistant", "required">, import("convex/values").VLiteral<"tool", "required">], "required", never>;
        content: import("convex/values").VString<string, "required">;
        toolCalls: import("convex/values").VArray<{
            id: string;
            name: string;
            arguments: string;
        }[] | undefined, import("convex/values").VObject<{
            id: string;
            name: string;
            arguments: string;
        }, {
            id: import("convex/values").VString<string, "required">;
            name: import("convex/values").VString<string, "required">;
            arguments: import("convex/values").VString<string, "required">;
        }, "required", "id" | "name" | "arguments">, "optional">;
        toolResults: import("convex/values").VArray<{
            toolCallId: string;
            result: string;
        }[] | undefined, import("convex/values").VObject<{
            toolCallId: string;
            result: string;
        }, {
            toolCallId: import("convex/values").VString<string, "required">;
            result: import("convex/values").VString<string, "required">;
        }, "required", "toolCallId" | "result">, "optional">;
        createdAt: import("convex/values").VFloat64<number, "required">;
    }, "required", "conversationId" | "content" | "toolCalls" | "toolResults" | "createdAt" | "role">, {
        by_conversation: ["conversationId", "createdAt", "_creationTime"];
    }, {}, {}>;
    streamingMessages: import("convex/server").TableDefinition<import("convex/values").VObject<{
        endedAt?: number | undefined;
        abortReason?: string | undefined;
        timeoutFnId?: import("convex/values").GenericId<"_scheduled_functions"> | undefined;
        conversationId: import("convex/values").GenericId<"conversations">;
        status: "streaming" | "finished" | "aborted";
        startedAt: number;
        lastHeartbeat: number;
    }, {
        conversationId: import("convex/values").VId<import("convex/values").GenericId<"conversations">, "required">;
        status: import("convex/values").VUnion<"streaming" | "finished" | "aborted", [import("convex/values").VLiteral<"streaming", "required">, import("convex/values").VLiteral<"finished", "required">, import("convex/values").VLiteral<"aborted", "required">], "required", never>;
        startedAt: import("convex/values").VFloat64<number, "required">;
        endedAt: import("convex/values").VFloat64<number | undefined, "optional">;
        abortReason: import("convex/values").VString<string | undefined, "optional">;
        lastHeartbeat: import("convex/values").VFloat64<number, "required">;
        timeoutFnId: import("convex/values").VId<import("convex/values").GenericId<"_scheduled_functions"> | undefined, "optional">;
    }, "required", "conversationId" | "status" | "startedAt" | "endedAt" | "abortReason" | "lastHeartbeat" | "timeoutFnId">, {
        by_conversation: ["conversationId", "_creationTime"];
        by_conversation_status: ["conversationId", "status", "_creationTime"];
    }, {}, {}>;
    streamDeltas: import("convex/server").TableDefinition<import("convex/values").VObject<{
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
    }, {
        streamId: import("convex/values").VId<import("convex/values").GenericId<"streamingMessages">, "required">;
        start: import("convex/values").VFloat64<number, "required">;
        end: import("convex/values").VFloat64<number, "required">;
        parts: import("convex/values").VArray<{
            error?: string | undefined;
            text?: string | undefined;
            toolCallId?: string | undefined;
            result?: string | undefined;
            toolName?: string | undefined;
            args?: string | undefined;
            type: "text-delta" | "tool-call" | "tool-result" | "error";
        }[], import("convex/values").VObject<{
            error?: string | undefined;
            text?: string | undefined;
            toolCallId?: string | undefined;
            result?: string | undefined;
            toolName?: string | undefined;
            args?: string | undefined;
            type: "text-delta" | "tool-call" | "tool-result" | "error";
        }, {
            type: import("convex/values").VUnion<"text-delta" | "tool-call" | "tool-result" | "error", [import("convex/values").VLiteral<"text-delta", "required">, import("convex/values").VLiteral<"tool-call", "required">, import("convex/values").VLiteral<"tool-result", "required">, import("convex/values").VLiteral<"error", "required">], "required", never>;
            text: import("convex/values").VString<string | undefined, "optional">;
            toolCallId: import("convex/values").VString<string | undefined, "optional">;
            toolName: import("convex/values").VString<string | undefined, "optional">;
            args: import("convex/values").VString<string | undefined, "optional">;
            result: import("convex/values").VString<string | undefined, "optional">;
            error: import("convex/values").VString<string | undefined, "optional">;
        }, "required", "error" | "text" | "type" | "toolCallId" | "result" | "toolName" | "args">, "required">;
    }, "required", "streamId" | "start" | "end" | "parts">, {
        by_stream_cursor: ["streamId", "start", "_creationTime"];
    }, {}, {}>;
}, true>;
export default _default;
//# sourceMappingURL=schema.d.ts.map