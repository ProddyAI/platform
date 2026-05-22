import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function safeDeleteDocument(ctx: MutationCtx, id: Id<TableNames>) {
	const existing = await ctx.db.get(id);
	if (!existing) {
		return;
	}
	await ctx.db.delete(id);
}
