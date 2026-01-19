import crypto from "node:crypto";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

export async function POST(req: Request) {
	try {
		const { workspaceId, invite } = await req.json();

		if (!workspaceId || !invite) {
			return NextResponse.json({ error: "Missing data" }, { status: 400 });
		}

		// 1. Verify authentication
		const isAuthenticated = await isAuthenticatedNextjs();
		if (!isAuthenticated) {
			return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
		}

		// 2. Get logged-in user
		const convex = createConvexClient();
		const token = await convexAuthNextjsToken();
		if (token && typeof token === "string") {
			convex.setAuth(token);
		}

		const currentUser = await convex.query(api.users.current);
		if (!currentUser || !currentUser.email) {
			return NextResponse.json(
				{ error: "User not found or email missing" },
				{ status: 404 }
			);
		}

		const email = currentUser.email.toLowerCase();

		// 3. Fetch invite by hash
		const inviteDoc = await fetchQuery(api.workspaceInvites.getInviteByHash, {
			hash: invite,
		});

		if (!inviteDoc) {
			return NextResponse.json({ error: "Invalid invite" }, { status: 400 });
		}

		// 4. Verify that the invite email matches the current user's email
		if (inviteDoc.email !== email) {
			return NextResponse.json(
				{ error: "This invite was not sent to your email address" },
				{ status: 403 }
			);
		}

		// 5. Recompute hash to verify email binding
		const joinCode = await fetchQuery(
			api.workspaceInvites.getWorkspaceJoinCode,
			{ workspaceId: workspaceId as Id<"workspaces"> }
		);

		if (!process.env.INVITE_SECRET) {
			throw new Error("INVITE_SECRET environment variable is required");
		}

		const raw = `${joinCode}:${email}:${process.env.INVITE_SECRET}`;
		const expectedHash = crypto.createHash("sha256").update(raw).digest("hex");

		if (expectedHash !== invite) {
			return NextResponse.json(
				{ error: "Invite does not belong to this email" },
				{ status: 403 }
			);
		}

		// 6. Consume invite
		await fetchMutation(api.workspaceInvites.consumeInvite, {
			inviteId: inviteDoc._id,
			userId: currentUser._id,
		});

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: "Failed to verify invite" },
			{ status: 500 }
		);
	}
}
