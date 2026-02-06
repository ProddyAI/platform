import crypto from "node:crypto";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api, internal } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

const maskInvite = (invite: string) => `...${invite.slice(-8)}`;
const _maskEmail = () => "[redacted-email]";

export async function POST(req: Request) {
	try {
		const { workspaceId, invite } = await req.json();

		if (!workspaceId || !invite) {
			console.error("[Invite Verify] Missing data for workspace:", workspaceId);
			return NextResponse.json({ error: "Missing data" }, { status: 400 });
		}

		// 1. Verify authentication
		const isAuthenticated = await isAuthenticatedNextjs();
		if (!isAuthenticated) {
			console.error("[Invite Verify] User not authenticated");
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		// 2. Get logged-in user
		const convex = createConvexClient();
		const token = await convexAuthNextjsToken();
		if (!token || typeof token !== "string") {
			console.error("[Invite Verify] Invalid token");
			return NextResponse.json(
				{ error: "Invalid authentication token" },
				{ status: 401 }
			);
		}
		convex.setAuth(token);

		const currentUser = await convex.query(api.users.current);
		if (!currentUser || !currentUser.email) {
			console.error("[Invite Verify] User not found or email missing");
			return NextResponse.json(
				{ error: "User not found or email missing" },
				{ status: 404 }
			);
		}

		const email = currentUser.email.toLowerCase();
		console.log(
			"[Invite Verify] Processing invite for workspace:",
			workspaceId
		);

		// 3. Fetch invite by hash
		const inviteDoc = await fetchQuery(api.workspaceInvites.getInviteByHash, {
			hash: invite,
		});

		if (!inviteDoc) {
			console.error(
				"[Invite Verify] Invite not found for hash:",
				maskInvite(invite)
			);
			return NextResponse.json(
				{ error: "Invalid or expired invite link" },
				{ status: 400 }
			);
		}

		// Check if invite has already been used
		if (inviteDoc.used) {
			console.error("[Invite Verify] Invite already used:", maskInvite(invite));
			return NextResponse.json(
				{ error: "This invite has already been used" },
				{ status: 400 }
			);
		}

		// Check if invite has expired
		if (inviteDoc.expiresAt < Date.now()) {
			console.error("[Invite Verify] Invite expired:", maskInvite(invite));
			return NextResponse.json(
				{ error: "This invite has expired. Please request a new one" },
				{ status: 400 }
			);
		}

		// 4. Verify that the invite email matches the current user's email
		if (inviteDoc.email !== email) {
			console.error(
				"[Invite Verify] Email mismatch for workspace:",
				workspaceId
			);
			return NextResponse.json(
				{
					error:
						"This invite was sent to a different email address. Please sign in with the correct account",
				},
				{ status: 403 }
			);
		}

		// 5. Recompute hash to verify email binding
		// Use internal query to get joinCode without exposing it on public API
		const joinCode = await fetchQuery(
			internal.workspaceInvites
				.getWorkspaceJoinCodeForInviteVerification as any,
			{ workspaceId: workspaceId as Id<"workspaces"> }
		);

		if (!process.env.INVITE_SECRET) {
			console.error("[Invite Verify] INVITE_SECRET not configured");
			throw new Error("INVITE_SECRET environment variable is required");
		}

		if (!joinCode) {
			console.error(
				"[Invite Verify] Workspace not found or missing join code:",
				workspaceId
			);
			return NextResponse.json(
				{ error: "Workspace not found or has no join code" },
				{ status: 404 }
			);
		}

		const raw = `${joinCode}:${email}:${process.env.INVITE_SECRET}`;
		const expectedHash = crypto.createHash("sha256").update(raw).digest("hex");

		if (expectedHash !== invite) {
			console.error(
				"[Invite Verify] Hash mismatch for workspace:",
				workspaceId
			);
			return NextResponse.json(
				{
					error:
						"Invalid invite link. The invite may have been regenerated or is corrupted",
				},
				{ status: 403 }
			);
		}

		// 6. Consume invite
		console.log("[Invite Verify] Consuming invite for workspace:", workspaceId);
		await fetchMutation(api.workspaceInvites.consumeInvite, {
			inviteId: inviteDoc._id,
			userId: currentUser._id,
		});

		console.log("[Invite Verify] Successfully verified and consumed invite");
		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("[Invite Verify] Error:", err);
		return NextResponse.json(
			{ error: "Failed to verify invite" },
			{ status: 500 }
		);
	}
}
