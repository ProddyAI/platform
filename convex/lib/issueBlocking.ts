import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export type AddIssueBlockingRelationshipArgs = {
	channelId: Id<"channels">;
	blockedIssueId: Id<"issues">;
	blockingIssueId: Id<"issues">;
	reasoning?: string;
	resolutionSteps?: string[];
	createdBy: Id<"members">;
};

/** Shared by public mutations; caller must enforce workspace auth. */
export async function addIssueBlockingRelationshipHelper(
	ctx: MutationCtx,
	{
		channelId,
		blockedIssueId,
		blockingIssueId,
		reasoning,
		resolutionSteps,
		createdBy,
	}: AddIssueBlockingRelationshipArgs
): Promise<void> {
	if (blockedIssueId === blockingIssueId) {
		throw new Error("An issue cannot block itself");
	}

	const channel = await ctx.db.get(channelId);
	if (!channel) throw new Error("Channel not found");

	const blockedIssue = await ctx.db.get(blockedIssueId);
	const blockingIssue = await ctx.db.get(blockingIssueId);
	if (!blockedIssue || !blockingIssue) {
		throw new Error("Issue not found");
	}

	if (
		blockedIssue.channelId !== channelId ||
		blockingIssue.channelId !== channelId
	) {
		throw new Error("Issues must belong to the same channel");
	}

	const visited = new Set<string>();
	const queue: Id<"issues">[] = [blockedIssueId];
	while (queue.length > 0) {
		const currentIssueId = queue.shift();
		if (!currentIssueId) continue;

		const visitedKey = String(currentIssueId);
		if (visited.has(visitedKey)) {
			continue;
		}
		visited.add(visitedKey);

		const outboundBlocking = await ctx.db
			.query("issueBlocking")
			.withIndex("by_blocked_issue_id", (q) =>
				q.eq("blockedIssueId", currentIssueId)
			)
			.collect();

		for (const rel of outboundBlocking) {
			if (rel.blockingIssueId === blockingIssueId) {
				throw new Error(
					"Circular dependency detected: the issue you're blocking already blocks this issue"
				);
			}

			if (!visited.has(String(rel.blockingIssueId))) {
				queue.push(rel.blockingIssueId);
			}
		}
	}

	const existing = await ctx.db
		.query("issueBlocking")
		.withIndex("by_channel_id_blocked_issue_id_blocking_issue_id", (q) =>
			q
				.eq("channelId", channelId)
				.eq("blockedIssueId", blockedIssueId)
				.eq("blockingIssueId", blockingIssueId)
		)
		.collect();

	if (existing.length > 0) {
		const rel = existing[0];
		if (rel && (reasoning !== undefined || resolutionSteps !== undefined)) {
			const patch: {
				updatedAt: number;
				reasoning?: string;
				resolutionSteps?: string[];
			} = { updatedAt: Date.now() };
			if (reasoning !== undefined) {
				patch.reasoning = reasoning;
			}
			if (resolutionSteps !== undefined) {
				patch.resolutionSteps = resolutionSteps;
			}
			await ctx.db.patch(rel._id, patch);
		}
		return;
	}

	const relationship: {
		channelId: typeof channelId;
		blockedIssueId: typeof blockedIssueId;
		blockingIssueId: typeof blockingIssueId;
		updatedAt: number;
		createdAt: number;
		createdBy: typeof createdBy;
		reasoning?: string;
		resolutionSteps?: string[];
	} = {
		channelId,
		blockedIssueId,
		blockingIssueId,
		updatedAt: Date.now(),
		createdAt: Date.now(),
		createdBy,
	};
	if (reasoning !== undefined) {
		relationship.reasoning = reasoning;
	}
	if (resolutionSteps !== undefined) {
		relationship.resolutionSteps = resolutionSteps;
	}
	await ctx.db.insert("issueBlocking", relationship);
}
