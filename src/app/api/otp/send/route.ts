import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { Resend } from "resend";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import { OTPVerificationMail } from "@/features/email/components/otp-verification-mail";

let resend: Resend | null = null;

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

export async function POST(req: Request) {
	try {
		if (!process.env.RESEND_API_KEY) {
			throw new Error("RESEND_API_KEY environment variable is required");
		}

		resend ??= new Resend(process.env.RESEND_API_KEY);

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

		// Generate OTP
		const result = await convex.mutation(api.emailVerification.generateOTP, {
			email: email.toLowerCase(),
		});

		if (!result.success || !result.otp) {
			return NextResponse.json(
				{ error: "Failed to generate OTP" },
				{ status: 500 }
			);
		}

		// Create the OTP email template
		const emailTemplate = OTPVerificationMail({
			email: email.toLowerCase(),
			otp: result.otp,
		});

		// Send email
		await resend.emails.send({
			from: "Proddy <no-reply@proddy.tech>",
			to: email,
			subject: "Verify your email - Proddy",
			react: emailTemplate,
		});

		return NextResponse.json({ success: true });
	} catch (err) {
		console.error("OTP send error:", err);

		// Handle specific error messages
		if (err instanceof Error) {
			return NextResponse.json({ error: err.message }, { status: 400 });
		}

		return NextResponse.json({ error: "Failed to send OTP" }, { status: 500 });
	}
}
