import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import { logger } from "@/lib/logger";

const createConvexClient = () => {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
};

const getErrorMessage = (error: unknown) => {
	if (error instanceof Error && error.message.trim()) {
		return error.message;
	}

	if (typeof error === "string" && error.trim()) {
		return error;
	}

	if (error && typeof error === "object") {
		const maybeMessage = Reflect.get(error, "message");

		if (typeof maybeMessage === "string" && maybeMessage.trim()) {
			return maybeMessage;
		}

		const maybeCause = Reflect.get(error, "cause");
		if (typeof maybeCause === "string" && maybeCause.trim()) {
			return maybeCause;
		}

		try {
			const serialized = JSON.stringify(error);
			if (serialized && serialized !== "{}") {
				return serialized;
			}
		} catch {
			// Fall through to own-property extraction.
		}

		try {
			const ownProps = Object.getOwnPropertyNames(error);
			if (ownProps.length > 0) {
				const extracted = Object.fromEntries(
					ownProps.map((prop) => [prop, Reflect.get(error, prop)])
				);
				const serialized = JSON.stringify(extracted);
				if (serialized && serialized !== "{}") {
					return serialized;
				}
			}
		} catch {
			// Ignore and return generic fallback below.
		}
	}

	return "Unknown error";
};

const sendOtpWithLegacyAction = async (
	convex: ConvexHttpClient,
	email: string
) => {
	const legacyResult = await convex.action(
		api.emailVerification.generateAndSendOTP,
		{
			email,
		}
	);

	if (!legacyResult.success) {
		throw new Error("Failed to generate OTP");
	}
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

		const normalizedEmail = email.toLowerCase().trim();

		const convex = createConvexClient();
		await sendOtpWithLegacyAction(convex, normalizedEmail);

		return NextResponse.json({ success: true });
	} catch (err) {
		// Log error without sensitive information
		const errorMessage = getErrorMessage(err);

		logger.error("OTP send failed", {
			error: errorMessage,
		});

		// Handle specific error messages
		if (err instanceof Error) {
			const message = err.message.trim() || errorMessage;
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

		return NextResponse.json({ error: errorMessage }, { status: 500 });
	}
}
