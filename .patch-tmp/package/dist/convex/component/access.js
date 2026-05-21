function notFound() {
    throw new Error("Not found");
}
export async function requireConversationExternalId(ctx, conversationId, externalId) {
    const conversation = await ctx.db.get(conversationId);
    if (!conversation || conversation.externalId !== externalId) {
        notFound();
    }
    return conversation;
}
export async function requireStreamExternalId(ctx, streamId, externalId) {
    const stream = await ctx.db.get(streamId);
    if (!stream) {
        notFound();
    }
    await requireConversationExternalId(ctx, stream.conversationId, externalId);
    return stream;
}
