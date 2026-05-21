import type { Id } from "./_generated/dataModel";
type DbCtx = {
    db: {
        get: (id: Id<"conversations"> | Id<"streamingMessages">) => Promise<any>;
    };
};
export declare function requireConversationExternalId(ctx: DbCtx, conversationId: Id<"conversations">, externalId: string): Promise<any>;
export declare function requireStreamExternalId(ctx: DbCtx, streamId: Id<"streamingMessages">, externalId: string): Promise<any>;
export {};
//# sourceMappingURL=access.d.ts.map