import { internalQuery } from "../_generated/server";

const USAGE_FIELDS = [
	"aiRequestCount",
	"aiDiagramCount",
	"aiSummaryCount",
	"messageCount",
	"taskCount",
	"channelCount",
	"boardCount",
	"noteCount",
] as const;

// Read-only consistency check for the denormalized structures. Recomputes truth
// and compares against the maintained rollups/counters. All *Mismatches should
// be 0. Safe to run on any deployment; intended for post-backfill verification.
export const verifyDenormalization = internalQuery({
	args: {},
	handler: async (ctx) => {
		// usageStats rollup vs summed per-user rows
		const stats = await ctx.db.query("usageStats").collect();
		const usageTruth: Record<string, Record<string, number>> = {};
		for (const r of stats) {
			const k = `${r.workspaceId}|${r.month}`;
			usageTruth[k] = usageTruth[k] ?? {};
			for (const f of USAGE_FIELDS) {
				usageTruth[k][f] = (usageTruth[k][f] ?? 0) + (r[f] ?? 0);
			}
		}
		const totals = await ctx.db.query("workspaceUsageTotals").collect();
		let usageMismatches = 0;
		const seenUsageKeys = new Set<string>();
		for (const t of totals) {
			const k = `${t.workspaceId}|${t.month}`;
			seenUsageKeys.add(k);
			const exp = usageTruth[k] ?? {};
			for (const f of USAGE_FIELDS) {
				if ((t[f] ?? 0) !== (exp[f] ?? 0)) usageMismatches++;
			}
		}
		let usageMissingGroups = 0;
		for (const k of Object.keys(usageTruth)) {
			if (!seenUsageKeys.has(k)) usageMissingGroups++;
		}

		// message replyCount + plainText
		const messages = await ctx.db.query("messages").collect();
		let replyCountMismatches = 0;
		let missingPlainText = 0;
		for (const m of messages) {
			if (m.plainText === undefined) missingPlainText++;
			const replies = await ctx.db
				.query("messages")
				.withIndex("by_parent_message_id", (q) =>
					q.eq("parentMessageId", m._id)
				)
				.collect();
			if ((m.replyCount ?? 0) !== replies.length) replyCountMismatches++;
		}

		// projects.issueCount vs issues in board channel
		const projects = await ctx.db.query("projects").collect();
		let issueCountMismatches = 0;
		for (const p of projects) {
			const issues = await ctx.db
				.query("issues")
				.withIndex("by_channel_id", (q) => q.eq("channelId", p.boardChannelId))
				.collect();
			if ((p.issueCount ?? 0) !== issues.length) issueCountMismatches++;
		}

		return {
			usageStatsRows: stats.length,
			usageRollupRows: totals.length,
			usageMismatches,
			usageMissingGroups,
			messages: messages.length,
			missingPlainText,
			replyCountMismatches,
			projects: projects.length,
			issueCountMismatches,
		};
	},
});
