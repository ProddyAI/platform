import { type NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { PasswordResetMail } from "@/features/email/components/password-reset-mail";

const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour
const MAX_REQUESTS = 3; // Max 3 reset requests per hour per email

// In-memory rate limiting (in production, use Redis or database)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();

let resend: Resend | null = null;

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

export async function POST(request: NextRequest) {
	try {
		const body = await request.json();
		const { email, token } = body;

		if (!email || !token) {
			return NextResponse.json(
				{ error: "Email and token are required" },
				{ status: 400 }
			);
		}

		// Rate limiting
		const now = Date.now();
		const rateLimit = rateLimitStore.get(email);

		if (rateLimit) {
			if (now < rateLimit.resetAt) {
				if (rateLimit.count >= MAX_REQUESTS) {
					return NextResponse.json(
						{
							error: "Too many reset requests. Please try again later.",
						},
						{ status: 429 }
					);
				}
				rateLimit.count++;
			} else {
				// Reset the rate limit window
				rateLimitStore.set(email, {
					count: 1,
					resetAt: now + RATE_LIMIT_WINDOW,
				});
			}
		} else {
			rateLimitStore.set(email, {
				count: 1,
				resetAt: now + RATE_LIMIT_WINDOW,
			});
		}

		// Generate reset link
		const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
		const resetLink = `${baseUrl}/reset-password?token=${token}`;

		// Send email
		const resendClient = getResend();

		const emailTemplate = PasswordResetMail({
			email,
			resetLink,
		});

		const { data, error } = await resendClient.emails.send({
			from: "Proddy <noreply@proddy.tech>",
			to: email,
			subject: "Reset Your Password - Proddy",
			react: emailTemplate,
		});

		if (error) {
			console.error("Error sending password reset email:", error);
			return NextResponse.json(
				{ error: "Failed to send reset email" },
				{ status: 500 }
			);
		}

		return NextResponse.json({
			success: true,
			message: "Password reset email sent successfully",
			data,
		});
	} catch (error) {
		console.error("Password reset email error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
