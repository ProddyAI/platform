import crypto from "node:crypto";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { api } from "@/../convex/_generated/api";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
	try {
		const { workspaceId, email } = await req.json();

		if (!workspaceId || !email) {
			return NextResponse.json(
				{ error: "workspaceId and email are required" },
				{ status: 400 }
			);
		}

		// 1. Get joinCode from Convex
		const joinCode = await fetchQuery(
			api.workspaceInvites.getWorkspaceJoinCode,
			{ workspaceId }
		);

		// 2. Generate secure hash
		const raw = `${joinCode}:${email}:${process.env.INVITE_SECRET}`;
		const hash = crypto.createHash("sha256").update(raw).digest("hex");

		// 3. Store invite in Convex
		await fetchMutation(api.workspaceInvites.insertInvite, {
			workspaceId,
			email: email.toLowerCase(),
			hash,
			expiresAt: Date.now() + 1000 * 60 * 60 * 48, // 48 hours
		});

		// 4. Build invite link
		const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join/${workspaceId}?invite=${hash}`;

		// 5. Send email
		await resend.emails.send({
			from: "Proddy <no-reply@proddy.tech>",
			to: email,
			subject: "You've been invited to a workspace",
			html: `
				<p>You've been invited to join a workspace.</p>
				<p>
					<a href="${inviteLink}">Accept invite</a>
				</p>
				<p>This invite expires in 48 hours.</p>
			`,
		});

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error(err);
		return NextResponse.json(
			{ error: "Failed to send invite" },
			{ status: 500 }
		);
	}
}
