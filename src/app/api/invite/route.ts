import crypto from "node:crypto";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { fetchMutation, fetchQuery } from "convex/nextjs";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
	try {
		if (!isAuthenticatedNextjs()) {
			return NextResponse.json(
				{ error: "Unauthorized. Please sign in to send invites." },
				{ status: 401 }
			);
		}

		const token = await convexAuthNextjsToken();
		if (!token) {
			return NextResponse.json(
				{ error: "Invalid authentication token" },
				{ status: 401 }
			);
		}

		if (!process.env.INVITE_SECRET) {
			throw new Error("INVITE_SECRET environment variable is required");
		}

		if (!process.env.NEXT_PUBLIC_APP_URL) {
			throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
		}

		const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);
		convex.setAuth(token);

		const { workspaceId, email } = await req.json();

		if (!workspaceId || !email) {
			return NextResponse.json(
				{ error: "workspaceId and email are required" },
				{ status: 400 }
			);
		}

		const emailSchema = z.string().email();
		const emailValidation = emailSchema.safeParse(email);

		if (!emailValidation.success) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 }
			);
		}

		const rateLimitCheck = await convex.query(api.rateLimit.checkRateLimit, {
			workspaceId,
			email: email.toLowerCase(),
		});

		if (!rateLimitCheck.allowed) {
			return NextResponse.json(
				{ error: rateLimitCheck.reason },
				{ status: 429 }
			);
		}

		const [inviteDetails, joinCode] = await Promise.all([
			fetchQuery(api.workspaceInvites.getInviteDetails, { workspaceId }),
			fetchQuery(api.workspaceInvites.getWorkspaceJoinCode, { workspaceId }),
		]);

		const raw = `${joinCode}:${email}:${process.env.INVITE_SECRET}`;
		const hash = crypto.createHash("sha256").update(raw).digest("hex");

		await fetchMutation(api.workspaceInvites.insertInvite, {
			workspaceId,
			email: email.toLowerCase(),
			hash,
			expiresAt: Date.now() + 1000 * 60 * 60 * 48, // 48 hours
		});

		const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join/${workspaceId}?invite=${hash}`;

		await resend.emails.send({
			from: "Proddy <no-reply@proddy.tech>",
			to: email,
			subject: `You've been invited to join ${inviteDetails.workspaceName}`,
			html: `
				<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
					<h2 style="color: #333;">You've been invited to join a workspace</h2>
					
					<p style="font-size: 16px; color: #555;">
						<strong>${inviteDetails.senderName}</strong> (${inviteDetails.senderEmail}) has invited you to join the workspace <strong>${inviteDetails.workspaceName}</strong> on Proddy.
					</p>
					
					<div style="margin: 30px 0;">
						<a href="${inviteLink}" style="background-color: #0070f3; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
							Accept Invite
						</a>
					</div>
					
					<p style="font-size: 14px; color: #666;">
						This invite will expire in <strong>48 hours</strong>.
					</p>
					
					<hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
					
					<div style="background-color: #fff3cd; border-left: 4px solid #ffc107; padding: 15px; margin: 20px 0;">
						<p style="margin: 0; font-size: 14px; color: #856404;">
							<strong>⚠️ Security Notice:</strong> Only accept this invite if you trust the sender. Never share your login credentials with anyone.
						</p>
					</div>
					
					<p style="font-size: 12px; color: #999; margin-top: 30px;">
						If you didn't expect this invitation, you can safely ignore this email.
					</p>
				</div>
			`,
		});

		await convex.mutation(api.rateLimit.recordRateLimit, {
			workspaceId,
			email: email.toLowerCase(),
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
