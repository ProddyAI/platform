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
import { InviteMailTemplate } from "@/features/email/components/invite-mail";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: Request) {
	try {
		if (!(await isAuthenticatedNextjs())) {
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
			fetchQuery(api.workspaceInvites.getInviteDetails, { workspaceId }),
			fetchQuery(api.workspaceInvites.getWorkspaceJoinCode, { workspaceId }),
		]);

		const raw = `${joinCode}:${email.toLowerCase()}:${process.env.INVITE_SECRET}`;
		const hash = crypto.createHash("sha256").update(raw).digest("hex");

		await fetchMutation(api.workspaceInvites.insertInvite, {
			workspaceId,
			email: email.toLowerCase(),
			hash,
			expiresAt: Date.now() + 1000 * 60 * 60 * 48, // 48 hours
		});

		const inviteLink = `${process.env.NEXT_PUBLIC_APP_URL}/join/${workspaceId}?invite=${hash}`;

		// Create the invite email template
		const emailTemplate = InviteMailTemplate({
			senderName: inviteDetails.senderName,
			senderEmail: inviteDetails.senderEmail,
			workspaceName: inviteDetails.workspaceName,
			inviteLink,
		});

		await resend.emails.send({
			from: "Proddy <no-reply@proddy.tech>",
			to: email,
			subject: `You've been invited to join ${inviteDetails.workspaceName}`,
			react: emailTemplate,
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
