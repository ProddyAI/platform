import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import { OTPVerificationMail } from "@/features/email/components/otp-verification-mail";
import { logger } from "@/lib/logger";

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

export async function POST(req: Request) {
	try {
		const { email } = await req.json();

		if (!email) {
			return NextResponse.json({ error: "Email is required" }, { status: 400 });
		}

		const emailSchema = z.string().email();
		const emailValidation = emailSchema.safeParse(email);

		if (!emailValidation.success) {
			return NextResponse.json(
				{ error: "Invalid email format" },
				{ status: 400 }
			);
		}

		const convex = createConvexClient();
		const resendClient = getResend();

		// Generate OTP in Convex (secure - OTP only returned internally)
		const result = await convex.action(
			api.emailVerification.generateOTPForEmail,
			{
				email: email.toLowerCase(),
			}
		);

		if (!result.success || !result.otp) {
			return NextResponse.json(
				{ error: "Failed to generate OTP" },
				{ status: 500 }
			);
		}

		// Send email using React Email template
		const emailTemplate = OTPVerificationMail({
			email: email.toLowerCase(),
			otp: result.otp,
		});

		await resendClient.emails.send({
			from: process.env.RESEND_FROM_EMAIL || "Proddy <support@proddy.tech>",
			to: email.toLowerCase(),
			subject: "Verify your email - Proddy",
			react: emailTemplate,
			replyTo: process.env.NEXT_PUBLIC_SUPPORT_EMAIL || "support@proddy.tech",
		});

		return NextResponse.json({ success: true });
	} catch (err) {
		// Log error without sensitive information
		logger.error("OTP send failed", {
			error: err instanceof Error ? err.message : "Unknown error",
		});

		// Handle specific error messages
		if (err instanceof Error) {
			const message = err.message || "Failed to send OTP";
			const lowerMessage = message.toLowerCase();

			// Map rate limiting errors to 429 Too Many Requests
			if (
				lowerMessage.includes("rate limit") ||
				lowerMessage.includes("too many requests")
			) {
				return NextResponse.json({ error: message }, { status: 429 });
			}

			// Default to internal server error for other unexpected errors
			return NextResponse.json({ error: message }, { status: 500 });
		}

		return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
	}
}
