import { getAuthUserId } from "@convex-dev/auth/server";
import { ProsemirrorSync } from "@convex-dev/prosemirror-sync";
import { components } from "./_generated/api";
import type { Id } from "./_generated/dataModel";

const prosemirrorSync = new ProsemirrorSync<Id<"notes">>({
	lib: components.prosemirrorSync.lib,
});

export const {
	getSnapshot,
	submitSnapshot,
	latestVersion,
	getSteps,
	submitSteps,
} = prosemirrorSync.syncApi({
	async checkRead(ctx, noteId) {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Get the note to check workspace access
		const note = await ctx.db.get(noteId);
		if (!note) {
			throw new Error("Note not found");
		}

		// Verify the user has access to this note's workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q: any) =>
				q.eq("workspaceId", note.workspaceId).eq("userId", userId)
			)
			.first();

		if (!member) {
			throw new Error("Unauthorized");
		}
	},

	async checkWrite(ctx, noteId) {
		const userId = await getAuthUserId(ctx);

		if (!userId) {
			throw new Error("Unauthorized");
		}

		// Get the note to check workspace access
		const note = await ctx.db.get(noteId);
		if (!note) {
			throw new Error("Note not found");
		}

		// Verify the user has access to this note's workspace
		const member = await ctx.db
			.query("members")
			.withIndex("by_workspace_id_user_id", (q: any) =>
				q.eq("workspaceId", note.workspaceId).eq("userId", userId)
			)
			.first();

		if (!member) {
			throw new Error("Unauthorized");
		}
	},

	async onSnapshot(ctx, noteId, _snapshot, _version) {
		// Update the note's updatedAt timestamp when a snapshot is created
		const note = await ctx.db.get(noteId);
		if (note) {
			await ctx.db.patch(noteId, {
				updatedAt: Date.now(),
			});
		}
	},
});

// Export the prosemirrorSync instance for server-side document creation
export { prosemirrorSync };
