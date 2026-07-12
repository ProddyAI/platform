import type { Id } from "../_generated/dataModel";
import { internalMutation } from "../_generated/server";

// One-shot rebuild of the denormalized board state from source-of-truth rows:
//   - cards.workspaceId (derived via list -> channel)
//   - issueAssignees / cardAssignees link tables (from the assignees arrays)
//   - projects.issueCount (count of issues per board channel)
// Safe to re-run: it clears and rebuilds the link tables each time.
export const backfillBoardDenormalized = internalMutation({
	args: {},
	handler: async (ctx) => {
		for (const row of await ctx.db.query("issueAssignees").collect()) {
			await ctx.db.delete(row._id);
		}
		for (const row of await ctx.db.query("cardAssignees").collect()) {
			await ctx.db.delete(row._id);
		}

		const cards = await ctx.db.query("cards").collect();
		for (const card of cards) {
			const list = await ctx.db.get(card.listId);
			const channel = list ? await ctx.db.get(list.channelId) : null;
			const workspaceId = channel?.workspaceId;
			if (!workspaceId) {
				continue;
			}
			if (card.workspaceId !== workspaceId) {
				await ctx.db.patch(card._id, { workspaceId });
			}
			for (const memberId of card.assignees ?? []) {
				await ctx.db.insert("cardAssignees", {
					cardId: card._id,
					memberId,
					workspaceId,
				});
			}
		}

		const issueCountByChannel = new Map<Id<"channels">, number>();
		const issues = await ctx.db.query("issues").collect();
		for (const issue of issues) {
			issueCountByChannel.set(
				issue.channelId,
				(issueCountByChannel.get(issue.channelId) ?? 0) + 1
			);
			const channel = await ctx.db.get(issue.channelId);
			const workspaceId = channel?.workspaceId;
			if (!workspaceId) {
				continue;
			}
			for (const memberId of issue.assignees ?? []) {
				await ctx.db.insert("issueAssignees", {
					issueId: issue._id,
					memberId,
					workspaceId,
				});
			}
		}

		const projects = await ctx.db.query("projects").collect();
		for (const project of projects) {
			await ctx.db.patch(project._id, {
				issueCount: issueCountByChannel.get(project.boardChannelId) ?? 0,
			});
		}

		return {
			cards: cards.length,
			issues: issues.length,
			projects: projects.length,
		};
	},
});
