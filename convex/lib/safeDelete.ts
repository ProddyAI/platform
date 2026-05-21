import type { Id, TableNames } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

export async function safeDeleteDocument(ctx: MutationCtx, id: Id<TableNames>) {
	try {
		await ctx.db.delete(id);
	} catch (error) {
		if (
			error instanceof Error &&
			error.message.includes("nonexistent document")
		) {
			console.log(`Skipping delete of nonexistent document: ${id}`);
			return;
		}
		throw error;
	}
}
