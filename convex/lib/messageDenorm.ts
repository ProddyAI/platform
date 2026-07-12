import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { extractTextFromRichText } from "../content/richText";

// Plain text of a rich-text (or HTML) body, for the message search index.
export function plainTextFromBody(body: string): string {
	return extractTextFromRichText(body);
}

// Recompute a parent message's denormalized thread metadata from its replies.
// Used on delete (and by the backfill) where the last reply may have changed.
async function recomputeThreadMeta(
	ctx: MutationCtx,
	parentMessageId: Id<"messages">
) {
	const replies = await ctx.db
		.query("messages")
		.withIndex("by_parent_message_id", (q) =>
			q.eq("parentMessageId", parentMessageId)
		)
		.collect();
	const last = replies[replies.length - 1];
	await ctx.db.patch(parentMessageId, {
		replyCount: replies.length,
		lastReplyTime: last?._creationTime,
		lastReplyMemberId: last?.memberId,
	});
}

// After inserting a reply, bump the parent's counters. `reply` is the freshly
// inserted message doc (needs its _creationTime, memberId, parentMessageId).
export async function onReplyInserted(
	ctx: MutationCtx,
	reply: Doc<"messages">
) {
	if (!reply.parentMessageId) {
		return;
	}
	const parent = await ctx.db.get(reply.parentMessageId);
	if (!parent) {
		return;
	}
	await ctx.db.patch(reply.parentMessageId, {
		replyCount: (parent.replyCount ?? 0) + 1,
		lastReplyTime: reply._creationTime,
		lastReplyMemberId: reply.memberId,
	});
}

// Before deleting a reply, refresh the parent's counters from the remaining
// replies (the deleted one is excluded because it is removed first by caller,
// or recomputed to exclude it here). Call AFTER ctx.db.delete(reply).
export async function onReplyDeleted(
	ctx: MutationCtx,
	parentMessageId: Id<"messages"> | undefined
) {
	if (!parentMessageId) {
		return;
	}
	const parent = await ctx.db.get(parentMessageId);
	if (!parent) {
		return;
	}
	await recomputeThreadMeta(ctx, parentMessageId);
}
