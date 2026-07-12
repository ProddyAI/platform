import { v } from "convex/values";
import { internalMutation } from "../_generated/server";

const COUNTER_FIELDS = [
	"aiRequestCount",
	"aiDiagramCount",
	"aiSummaryCount",
	"messageCount",
	"taskCount",
	"channelCount",
	"boardCount",
	"noteCount",
] as const;

// Rebuild workspaceUsageTotals from the per-user usageStats rows. Sums the new
// counter fields (matching what applyUsageIncrement maintains and what the limit
// checks read). Idempotent: clears the rollup on the first page, then
// accumulates. Call repeatedly with the returned cursor until isDone, always
// starting a fresh run from cursor=null.
export const backfillWorkspaceUsageTotals = internalMutation({
	args: { cursor: v.optional(v.union(v.string(), v.null())) },
	handler: async (ctx, { cursor }) => {
		if (!cursor) {
			for (const t of await ctx.db.query("workspaceUsageTotals").collect()) {
				await ctx.db.delete(t._id);
			}
		}

		const page = await ctx.db
			.query("usageStats")
			.paginate({ cursor: cursor ?? null, numItems: 200 });

		for (const row of page.page) {
			const existing = await ctx.db
				.query("workspaceUsageTotals")
				.withIndex("by_workspace_month", (q) =>
					q.eq("workspaceId", row.workspaceId).eq("month", row.month)
				)
				.unique();

			if (existing) {
				const patch: Record<string, number> = { updatedAt: Date.now() };
				for (const f of COUNTER_FIELDS) {
					patch[f] = (existing[f] ?? 0) + (row[f] ?? 0);
				}
				await ctx.db.patch(existing._id, patch);
			} else {
				const doc: Record<string, unknown> = {
					workspaceId: row.workspaceId,
					month: row.month,
					updatedAt: Date.now(),
				};
				for (const f of COUNTER_FIELDS) {
					doc[f] = row[f] ?? 0;
				}
				await ctx.db.insert("workspaceUsageTotals", doc as never);
			}
		}

		return {
			processed: page.page.length,
			isDone: page.isDone,
			cursor: page.continueCursor,
		};
	},
});
