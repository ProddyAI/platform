import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

// Generate a 6-digit OTP
function createOTPCode(): string {
	return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate OTP and store it
export const generateOTP = mutation({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		// Check rate limiting - max 3 OTPs per email per hour
		const oneHourAgo = Date.now() - 60 * 60 * 1000;
		const recentOTPs = await ctx.db
			.query("emailVerifications")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.gte(q.field("createdAt"), oneHourAgo))
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

		return { otp, success: true };
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

		return { verified: !!verifiedOTP };
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
export const cleanupExpiredOTPs = mutation({
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
