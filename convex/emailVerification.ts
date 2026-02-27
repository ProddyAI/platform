import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";

// Generate a 6-digit OTP using crypto-secure random (V8-compatible)
function createOTPCode(): string {
	// Use crypto.getRandomValues which is available in V8 Isolate
	const array = new Uint32Array(1);
	crypto.getRandomValues(array);
	// Generate a number between 100000 and 999999
	const randomNum = (array[0] % 900000) + 100000;
	return randomNum.toString();
}

// Internal mutation to generate and store OTP (does not return OTP for security)
export const generateOTPInternal = internalMutation({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		// Check if email is already registered
		const existingUser = await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", email))
			.first();

		if (existingUser) {
			throw new Error(
				"This email is already registered. Please sign in instead."
			);
		}

		// Check rate limiting - max 3 unverified OTPs per email per hour
		// Only count unverified OTPs so successful verifications don't block legitimate users
		const oneHourAgo = Date.now() - 60 * 60 * 1000;
		const recentOTPs = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.gte(q.field("createdAt"), oneHourAgo))
			.filter((q) => q.eq(q.field("verified"), false))
			.collect();

		if (recentOTPs.length >= 3) {
			throw new Error("Too many OTP requests. Please try again after an hour.");
		}

		// Delete any existing unverified OTPs for this email
		const existingOTPs = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.eq(q.field("verified"), false))
			.collect();

		for (const otp of existingOTPs) {
			await ctx.db.delete(otp._id);
		}

		// Generate new OTP
		const otp = createOTPCode();
		const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

		// Store OTP
		await ctx.db.insert("emailVerifications", {
			email,
			otp,
			expiresAt,
			verified: false,
			attempts: 0,
			createdAt: Date.now(),
		});

		// Return OTP only internally (not exposed to client)
		return { otp, success: true };
	},
});

// Action to generate OTP (used by Next.js API route for email sending)
export const generateOTPForEmail = action({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args): Promise<{ success: boolean; otp: string }> => {
		const email = args.email.toLowerCase().trim();

		// Generate OTP internally
		const result: { otp: string; success: boolean } = await ctx.runMutation(
			internal.emailVerification.generateOTPInternal,
			{ email }
		);

		if (!result.success || !result.otp) {
			throw new Error("Failed to generate OTP");
		}

		// Return OTP for use by API route (only accessible server-side)
		return { success: true, otp: result.otp };
	},
});

// Legacy: Public action to generate OTP and send email (kept for backward compatibility)
// New implementation uses generateOTPForEmail + Next.js API route for better separation
export const generateAndSendOTP = action({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		// Generate OTP internally
		const result = await ctx.runMutation(
			internal.emailVerification.generateOTPInternal,
			{ email }
		);

		if (!result.success || !result.otp) {
			throw new Error("Failed to generate OTP");
		}

		// Send email using Resend
		const resendApiKey = process.env.RESEND_API_KEY;
		if (!resendApiKey) {
			throw new Error("RESEND_API_KEY environment variable is required");
		}

		const response = await fetch("https://api.resend.com/emails", {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Authorization: `Bearer ${resendApiKey}`,
			},
			body: JSON.stringify({
				from: "Proddy <no-reply@proddy.tech>",
				to: [email],
				subject: "Verify your email - Proddy",
				html: `
					<!DOCTYPE html>
					<html>
						<head>
							<meta charset="utf-8">
							<meta name="viewport" content="width=device-width, initial-scale=1.0">
						</head>
						<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
							<div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
								<h1 style="color: white; margin: 0; font-size: 28px;">Verify Your Email</h1>
							</div>
							<div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
								<p style="font-size: 16px; margin-bottom: 20px;">Hello,</p>
								<p style="font-size: 16px; margin-bottom: 20px;">Thank you for signing up with Proddy! To complete your registration, please use the following verification code:</p>
								<div style="background: white; padding: 20px; text-align: center; border-radius: 8px; margin: 30px 0; border: 2px solid #667eea;">
									<p style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 0; color: #667eea; font-family: 'Courier New', monospace;">${result.otp}</p>
								</div>
								<p style="font-size: 14px; color: #666; margin-bottom: 20px;">This code will expire in 10 minutes. If you didn't request this code, please ignore this email.</p>
								<p style="font-size: 16px; margin-top: 30px;">Best regards,<br><strong>The Proddy Team</strong></p>
							</div>
							<div style="text-align: center; margin-top: 20px; color: #999; font-size: 12px;">
								<p>© ${new Date().getFullYear()} Proddy. All rights reserved.</p>
							</div>
						</body>
					</html>
				`,
			}),
		});

		if (!response.ok) {
			const error = await response.json();
			console.error("Failed to send OTP email:", error);
			throw new Error("Failed to send OTP email");
		}

		// Return success only (no OTP)
		return { success: true };
	},
});

// Verify OTP
export const verifyOTP = mutation({
	args: {
		email: v.string(),
		otp: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();
		const otp = args.otp.trim();

		// Find the OTP record
		const otpRecord = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.eq(q.field("verified"), false))
			.first();

		if (!otpRecord) {
			throw new Error("No OTP found for this email. Please request a new one.");
		}

		// Check if expired
		if (otpRecord.expiresAt < Date.now()) {
			await ctx.db.delete(otpRecord._id);
			throw new Error("OTP has expired. Please request a new one.");
		}

		// Check attempt limit
		if (otpRecord.attempts >= 5) {
			await ctx.db.delete(otpRecord._id);
			throw new Error("Too many failed attempts. Please request a new OTP.");
		}

		// Verify OTP
		if (otpRecord.otp !== otp) {
			// Increment attempts
			await ctx.db.patch(otpRecord._id, {
				attempts: otpRecord.attempts + 1,
			});
			throw new Error("Invalid OTP. Please try again.");
		}

		// Mark as verified
		await ctx.db.patch(otpRecord._id, {
			verified: true,
		});

		return { success: true };
	},
});

// Check if email has a verified OTP
export const hasVerifiedOTP = query({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		const verifiedOTP = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.eq(q.field("verified"), true))
			.first();

		return { verified: Boolean(verifiedOTP) };
	},
});

// Get OTP expiry time
export const getOTPExpiry = query({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		const otpRecord = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.eq(q.field("verified"), false))
			.first();

		if (!otpRecord) {
			return { expiresAt: null };
		}

		return { expiresAt: otpRecord.expiresAt };
	},
});

// Cleanup expired OTPs (can be called periodically)
export const cleanupExpiredOTPs = internalMutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();
		const expiredOTPs = await ctx.db
			.query("emailVerifications")
			.withIndex("by_expiry", (q) => q.lt("expiresAt", now))
			.collect();

		let count = 0;
		for (const otp of expiredOTPs) {
			await ctx.db.delete(otp._id);
			count++;
		}

		return { deletedCount: count };
	},
});
