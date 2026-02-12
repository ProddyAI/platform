import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { api } from "@/../convex/_generated/api";
import { PasswordResetMail } from "@/features/email/components/password-reset-mail";

let resend: Resend | null = null;

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

const getResend = () => {
	if (!resend) {
		const resendApiKey = process.env.RESEND_API_KEY;
		if (!resendApiKey) {
			throw new Error("RESEND_API_KEY environment variable is required");
		}
		resend = new Resend(resendApiKey);
	}
	return resend;
};

/**
 * Password Reset Email Endpoint
 *
 * SECURITY: This endpoint only accepts email input from the client.
 * Token generation happens entirely server-side via Convex mutation to prevent:
 * - Token spoofing (client cannot provide arbitrary tokens for any email)
 * - Account enumeration attacks (always returns success regardless of account existence)
 * - Rate limit bypass (server-side rate limiting cannot be circumvented)
 *
 * Flow:
 * 1. Client sends email only
 * 2. Server validates rate limits
 * 3. Server generates token via Convex (token never exposed to client)
 * 4. Server sends email with reset link
 * 5. Client receives generic success message
 */
export async function POST(request: NextRequest) {
	try {
		// Validate required environment variables
		if (!process.env.NEXT_PUBLIC_APP_URL) {
			throw new Error("NEXT_PUBLIC_APP_URL environment variable is required");
		}

		if (!process.env.RESEND_API_KEY) {
			throw new Error("RESEND_API_KEY environment variable is required");
		}

		const body = await request.json();
		const { email } = body;

		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		// Normalize email to lowercase for consistency
		const normalizedEmail = email.toLowerCase().trim();

		// Initialize Convex client
		const convex = createConvexClient();

		// Validate and record rate limit using Convex
		const rateLimitCheck = await convex.mutation(
			api.rateLimit.validatePasswordResetRateLimit,
			{
				email: normalizedEmail,
			}
		);

		if (!rateLimitCheck.allowed) {
			return NextResponse.json(
				{ error: rateLimitCheck.reason },
				{ status: 429 }
			);
		}

		// Generate token server-side via Convex action
		// This ensures the token is never exposed to the client
		const result = await convex.action(
			api.passwordManagement.generatePasswordResetToken,
			{
				email: normalizedEmail,
			}
		);

		// Security: Always return same response to prevent account enumeration
		if (!result.token) {
			return NextResponse.json({
				success: true,
				message:
					"If an account exists with this email, a reset link will be sent.",
			});
		}

		const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${result.token}`;
		const resendClient = getResend();
		const emailTemplate = PasswordResetMail({
			email: normalizedEmail,
			resetLink,
		});

		const { error } = await resendClient.emails.send({
			from: process.env.RESEND_FROM_EMAIL || "Proddy <support@proddy.tech>",
			to: normalizedEmail,
			subject: "Reset Your Password - Proddy",
			react: emailTemplate,
			replyTo: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@proddy.tech",
		});

		if (error) {
			console.error("Error sending password reset email:", error);
			return NextResponse.json(
				{ error: "Failed to send reset email" },
				{ status: 500 }
			);
		}

		// Only return non-sensitive information to the client
		return NextResponse.json({
			success: true,
			message: "Password reset email sent successfully",
		});
	} catch (error) {
		console.error("Password reset email error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
