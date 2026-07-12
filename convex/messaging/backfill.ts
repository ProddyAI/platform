import { v } from "convex/values";
import { internalMutation } from "../_generated/server";
import { plainTextFromBody } from "../lib/messageDenorm";

// Paginated backfill for the message denormalizations:
//   - plainText (for the full-text search index)
//   - replyCount / lastReplyTime / lastReplyMemberId (thread metadata)
// Call repeatedly, passing back `cursor` until `isDone` is true. Each message
// gets its own thread metadata recomputed from its replies (0 for non-parents),
// so the pass is order-independent and safe to re-run.
export const backfillMessageDenormalized = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, { cursor }) => {
		const page = await ctx.db
			.query("messages")
			.paginate({ cursor: cursor ?? null, numItems: 100 });

		for (const msg of page.page) {
			const replies = await ctx.db
				.query("messages")
				.withIndex("by_parent_message_id", (q) =>
					q.eq("parentMessageId", msg._id)
				)
				.collect();
			const last = replies[replies.length - 1];

			await ctx.db.patch(msg._id, {
				plainText: plainTextFromBody(msg.body),
				replyCount: replies.length,
				lastReplyTime: last?._creationTime,
				lastReplyMemberId: last?.memberId,
			});
		}

		return {
			processed: page.page.length,
			isDone: page.isDone,
			cursor: page.continueCursor,
		};
	},
});
