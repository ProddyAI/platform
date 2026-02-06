import crypto from "node:crypto";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import { InviteMailTemplate } from "@/features/email/components/invite-mail";

let resend: Resend | null = null;

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

export async function POST(req: Request) {
	try {
		if (!(await isAuthenticatedNextjs())) {
			return NextResponse.json(
				{ error: "Unauthorized. Please sign in to send invites." },
				{ status: 401 }
			);
		}

		// Get auth token and setup authenticated Convex client
		const convex = createConvexClient();
		const token = await convexAuthNextjsToken();
		if (!token || typeof token !== "string") {
			return NextResponse.json(
				{ error: "Invalid authentication token" },
				{ status: 401 }
			);
		}
		convex.setAuth(token);

		if (!process.env.INVITE_SECRET) {
			console.error("[Invite Send] INVITE_SECRET not configured");
			throw new Error("INVITE_SECRET environment variable is required");
		}

		if (!process.env.NEXT_PUBLIC_APP_URL) {
			console.error("[Invite Send] NEXT_PUBLIC_APP_URL not configured");
			throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
		}

		if (!process.env.RESEND_API_KEY) {
			console.error("[Invite Send] RESEND_API_KEY not configured");
			throw new Error("RESEND_API_KEY environment variable is required");
		}

		console.log(
			"[Invite Send] Using APP_URL:",
			process.env.NEXT_PUBLIC_APP_URL
		);

		resend ??= new Resend(process.env.RESEND_API_KEY);

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

		// Atomically validate and record rate limit to prevent race conditions
		const rateLimitCheck = await convex.mutation(
			api.rateLimit.validateAndRecordRateLimit,
			{
				workspaceId,
				email: email.toLowerCase(),
			}
		);

		if (!rateLimitCheck.allowed) {
			return NextResponse.json(
				{ error: rateLimitCheck.reason },
				{ status: 429 }
			);
		}

		const [inviteDetails, joinCode] = await Promise.all([
			convex.query(api.workspaceInvites.getInviteDetails, { workspaceId }),
			convex.query(api.workspaceInvites.getWorkspaceJoinCode, { workspaceId }),
		]);

		const raw = `${joinCode}:${email.toLowerCase()}:${process.env.INVITE_SECRET}`;
		const hash = crypto.createHash("sha256").update(raw).digest("hex");

		console.log("[Invite Send] Creating invite for workspace:", workspaceId);

		await convex.mutation(api.workspaceInvites.insertInvite, {
			workspaceId,
			email: email.toLowerCase(),
			hash,
			expiresAt: Date.now() + 1000 * 60 * 60 * 48, // 48 hours
		});

		const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/join/${workspaceId}?invite=${hash}`;
		console.log(
			"[Invite Send] Generated invite link for workspace:",
			workspaceId
		);

		// Create the invite email template
		const emailTemplate = InviteMailTemplate({
			senderName: inviteDetails.senderName ?? "Team Member",
			senderEmail: inviteDetails.senderEmail ?? "team@proddy.tech",
			workspaceName: inviteDetails.workspaceName ?? "Workspace",
			inviteLink,
		});

		const emailResult = await resend.emails.send({
			from: "Proddy <no-reply@proddy.tech>",
			to: email,
			subject: `You've been invited to join ${inviteDetails.workspaceName}`,
			react: emailTemplate,
		});

		console.log(
			"[Invite Send] Email sent successfully. Email ID:",
			emailResult.data?.id
		);

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("[Invite Send] Error:", err);
		return NextResponse.json(
			{ error: "Failed to send invite" },
			{ status: 500 }
		);
	}
}
