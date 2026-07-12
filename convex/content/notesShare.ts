import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "../_generated/dataModel";
import {
	type MutationCtx,
	mutation,
	type QueryCtx,
	query,
} from "../_generated/server";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Base64-encoded SHA-256 — mirrors the one-way token hashing used elsewhere
// (see convex/authn/passwordManagement.ts). Fine for a low-stakes share
// password; keeps plaintext out of the database.
async function hashPassword(password: string): Promise<string> {
	const data = new TextEncoder().encode(`proddy-note-share:${password}`);
	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return btoa(String.fromCharCode(...hashArray));
}

// URL-safe random token used as the public share slug. crypto.getRandomValues
// is available in the Convex runtime and is preferred over Math.random().
function generateShareId(): string {
	const bytes = new Uint8Array(18);
	crypto.getRandomValues(bytes);
	return btoa(String.fromCharCode(...bytes))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/, "");
}

// Confirm the caller is a member of the note's workspace and return the note.
async function requireNoteAccess(
	ctx: MutationCtx | QueryCtx,
	noteId: Id<"notes">
) {
	const userId = await getAuthUserId(ctx);
	if (!userId) {
		throw new Error("Unauthorized");
	}

	const note = await ctx.db.get(noteId);
	if (!note) {
		throw new Error("Note not found");
	}

	const member = await ctx.db
		.query("members")
		.withIndex("by_workspace_id_user_id", (q) =>
			q.eq("workspaceId", note.workspaceId).eq("userId", userId)
		)
		.first();

	if (!member) {
		throw new Error("Unauthorized");
	}

	return note;
}

// ---------------------------------------------------------------------------
// Owner-facing queries + mutations (require auth)
// ---------------------------------------------------------------------------

// Current share configuration for a note — powers the Share dialog.
export const getShareSettings = query({
	args: { noteId: v.id("notes") },
	handler: async (ctx, args) => {
		const note = await requireNoteAccess(ctx, args.noteId);

		return {
			isPublic: note.isPublic ?? false,
			publicShareId: note.publicShareId ?? null,
			hasPassword: Boolean(note.sharePasswordHash),
			sharedAt: note.sharedAt ?? null,
		};
	},
});

// Enable public sharing. Generates a share slug the first time and, when a
// password is provided, gates the public page behind it.
export const enableSharing = mutation({
	args: {
		noteId: v.id("notes"),
		password: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const note = await requireNoteAccess(ctx, args.noteId);

		const publicShareId = note.publicShareId ?? generateShareId();

		const patch: {
			isPublic: boolean;
			publicShareId: string;
			sharedAt: number;
			updatedAt: number;
			sharePasswordHash?: string;
		} = {
			isPublic: true,
			publicShareId,
			sharedAt: note.sharedAt ?? Date.now(),
			updatedAt: Date.now(),
		};

		if (args.password !== undefined) {
			const trimmed = args.password.trim();
			if (trimmed.length > 0) {
				patch.sharePasswordHash = await hashPassword(trimmed);
			}
		}

		await ctx.db.patch(args.noteId, patch);

		return { publicShareId, isPublic: true };
	},
});

// Turn public sharing off. The slug is retained so re-enabling reuses the same
// link, but access is immediately revoked.
export const disableSharing = mutation({
	args: { noteId: v.id("notes") },
	handler: async (ctx, args) => {
		await requireNoteAccess(ctx, args.noteId);

		await ctx.db.patch(args.noteId, {
			isPublic: false,
			updatedAt: Date.now(),
		});

		return { isPublic: false };
	},
});

// Set, change, or remove the share password. Pass null/empty to remove it.
export const setSharePassword = mutation({
	args: {
		noteId: v.id("notes"),
		password: v.union(v.string(), v.null()),
	},
	handler: async (ctx, args) => {
		await requireNoteAccess(ctx, args.noteId);

		const trimmed = args.password?.trim() ?? "";

		await ctx.db.patch(args.noteId, {
			sharePasswordHash:
				trimmed.length > 0 ? await hashPassword(trimmed) : undefined,
			updatedAt: Date.now(),
		});

		return { hasPassword: trimmed.length > 0 };
	},
});

// ---------------------------------------------------------------------------
// Public query (NO auth) — powers the /share/note/<shareId> page
// ---------------------------------------------------------------------------

export const getPublicNote = query({
	args: {
		shareId: v.string(),
		password: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		const note = await ctx.db
			.query("notes")
			.withIndex("by_public_share_id", (q) =>
				q.eq("publicShareId", args.shareId)
			)
			.first();

		if (!note?.isPublic) {
			return { status: "not_found" as const };
		}

		const requiresPassword = Boolean(note.sharePasswordHash);

		if (requiresPassword) {
			const supplied = args.password?.trim() ?? "";
			if (supplied.length === 0) {
				// Ask for a password without revealing the note contents.
				return {
					status: "password_required" as const,
					title: note.title,
				};
			}

			const suppliedHash = await hashPassword(supplied);
			if (suppliedHash !== note.sharePasswordHash) {
				return {
					status: "password_incorrect" as const,
					title: note.title,
				};
			}
		}

		// Authorized: hand out the noteId so the client can render the live
		// collaborative document read-only (see prosemirror.ts checkRead, which
		// permits reads on public notes).
		return {
			status: "ok" as const,
			noteId: note._id,
			title: note.title,
			tags: note.tags ?? [],
			createdAt: note.createdAt,
			updatedAt: note.updatedAt,
			hasPassword: requiresPassword,
		};
	},
});
