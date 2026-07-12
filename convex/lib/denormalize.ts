import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

// Keep the issueAssignees link table in sync with an issue's assignees array.
// Call after inserting or after patching assignees. Idempotent.
export async function syncIssueAssignees(
	ctx: MutationCtx,
	issueId: Id<"issues">,
	workspaceId: Id<"workspaces">,
	assignees: Id<"members">[] | undefined
) {
	const existing = await ctx.db
		.query("issueAssignees")
		.withIndex("by_issue_id", (q) => q.eq("issueId", issueId))
		.collect();
	for (const row of existing) {
		await ctx.db.delete(row._id);
	}
	for (const memberId of assignees ?? []) {
		await ctx.db.insert("issueAssignees", { issueId, memberId, workspaceId });
	}
}

// Remove all assignee links for an issue. Call before/when deleting the issue.
export async function removeIssueAssignees(
	ctx: MutationCtx,
	issueId: Id<"issues">
) {
	const existing = await ctx.db
		.query("issueAssignees")
		.withIndex("by_issue_id", (q) => q.eq("issueId", issueId))
		.collect();
	for (const row of existing) {
		await ctx.db.delete(row._id);
	}
}

// Keep the cardAssignees link table in sync with a card's assignees array.
export async function syncCardAssignees(
	ctx: MutationCtx,
	cardId: Id<"cards">,
	workspaceId: Id<"workspaces">,
	assignees: Id<"members">[] | undefined
) {
	const existing = await ctx.db
		.query("cardAssignees")
		.withIndex("by_card_id", (q) => q.eq("cardId", cardId))
		.collect();
	for (const row of existing) {
		await ctx.db.delete(row._id);
	}
	for (const memberId of assignees ?? []) {
		await ctx.db.insert("cardAssignees", { cardId, memberId, workspaceId });
	}
}

// Remove all assignee links for a card. Call before/when deleting the card.
export async function removeCardAssignees(
	ctx: MutationCtx,
	cardId: Id<"cards">
) {
	const existing = await ctx.db
		.query("cardAssignees")
		.withIndex("by_card_id", (q) => q.eq("cardId", cardId))
		.collect();
	for (const row of existing) {
		await ctx.db.delete(row._id);
	}
}

// Adjust the denormalized issueCount on the project whose board is `channelId`.
// No-op when the channel is not a project board. Never drops below zero.
export async function adjustProjectIssueCount(
	ctx: MutationCtx,
	channelId: Id<"channels">,
	delta: number
) {
	const project = await ctx.db
		.query("projects")
		.withIndex("by_board_channel_id", (q) => q.eq("boardChannelId", channelId))
		.first();
	if (!project) {
		return;
	}
	const next = Math.max(0, (project.issueCount ?? 0) + delta);
	await ctx.db.patch(project._id, { issueCount: next });
}
