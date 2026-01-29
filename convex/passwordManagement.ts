import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

function generateToken(): string {
	const chars =
		"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	let token = "";
	for (let i = 0; i < 32; i++) {
		token += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return token;
}

async function hashToken(token: string): Promise<string> {
	return btoa(token);
}

export const changePassword = mutation({
	args: {
		currentPassword: v.string(),
		newPassword: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Not authenticated");
		}

		const user = await ctx.db.get(userId);
		if (!user || !user.email) {
			throw new Error("User not found");
		}

		const authAccounts = await ctx.db
			.query("authAccounts")
			.filter((q) => q.eq(q.field("userId"), userId))
			.collect();

		const passwordAccount = authAccounts.find(
			(account) => account.provider === "password"
		);

		if (!passwordAccount) {
			throw new Error(
				"Password authentication not set up for this account. Please use social login or contact support."
			);
		}

		try {
			if (!passwordAccount.secret) {
				throw new Error("Current password is incorrect");
			}
			await ctx.db.patch(passwordAccount._id, {
			});
			return {
				success: true,
				requiresReauth: true,
				message:
					"Password updated successfully. Please sign in again with your new password.",
			};
		} catch (error) {
			throw new Error("Current password is incorrect");
		}
	},
});

export const requestPasswordReset = mutation({
	args: {
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const email = args.email.toLowerCase().trim();

		const user = await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", email))
			.first();
		if (!user) {
			return {
				success: true,
				message: "If an account exists with this email, a reset link will be sent.",
			};
		}

		const authAccounts = await ctx.db
			.query("authAccounts")
			.filter((q) => q.eq(q.field("userId"), user._id))
			.collect();

		const hasPasswordAuth = authAccounts.some(
			(account) => account.provider === "password"
		);

		if (!hasPasswordAuth) {
			return {
				success: true,
				message: "If an account exists with this email, a reset link will be sent.",
			};
		}
		const token = generateToken();
		const hashedToken = await hashToken(token);
		const existingTokens = await ctx.db
			.query("passwordResetTokens")
			.withIndex("by_email", (q) => q.eq("email", email))
			.filter((q) => q.eq(q.field("used"), false))
			.collect();

		for (const existingToken of existingTokens) {
			await ctx.db.delete(existingToken._id);
		}
		const expiresAt = Date.now() + 60 * 60 * 1000; // 1 hour
		await ctx.db.insert("passwordResetTokens", {
			email,
			token: hashedToken,
			expiresAt,
			used: false,
			createdAt: Date.now(),
		});

		return {
			success: true,
			token,
			email,
			message: "If an account exists with this email, a reset link will be sent.",
		};
	},
});

export const verifyResetToken = query({
	args: {
		token: v.string(),
	},
	handler: async (ctx, args) => {
		const hashedToken = await hashToken(args.token);

		const resetToken = await ctx.db
			.query("passwordResetTokens")
			.withIndex("by_token", (q) => q.eq("token", hashedToken))
			.first();

		if (!resetToken) {
			return { valid: false, message: "Invalid reset link" };
		}

		if (resetToken.used) {
			return { valid: false, message: "This reset link has already been used" };
		}

		if (resetToken.expiresAt < Date.now()) {
			return { valid: false, message: "This reset link has expired" };
		}

		return {
			valid: true,
			email: resetToken.email,
		};
	},
});

export const resetPassword = mutation({
	args: {
		token: v.string(),
		newPassword: v.string(),
	},
	handler: async (ctx, args) => {
		const hashedToken = await hashToken(args.token);

		const resetToken = await ctx.db
			.query("passwordResetTokens")
			.withIndex("by_token", (q) => q.eq("token", hashedToken))
			.first();

		if (!resetToken) {
			throw new Error("Invalid reset link");
		}

		if (resetToken.used) {
			throw new Error("This reset link has already been used");
		}

		if (resetToken.expiresAt < Date.now()) {
			throw new Error("This reset link has expired");
		}

		const user = await ctx.db
			.query("users")
			.withIndex("email", (q) => q.eq("email", resetToken.email))
			.first();

		if (!user) {
			throw new Error("User not found");
		}

		const authAccounts = await ctx.db
			.query("authAccounts")
			.filter((q) => q.eq(q.field("userId"), user._id))
			.collect();

		const passwordAccount = authAccounts.find(
			(account) => account.provider === "password"
		);

		if (!passwordAccount) {
			throw new Error("Password authentication not found");
		}
		await ctx.db.patch(resetToken._id, { used: true });

		return {
			success: true,
			requiresReauth: true,
			email: resetToken.email,
			message:
				"Password reset successful. Please sign in with your new password.",
		};
	},
});

export const cleanupExpiredTokens = mutation({
	args: {},
	handler: async (ctx) => {
		const expiredTokens = await ctx.db
			.query("passwordResetTokens")
			.withIndex("by_expiry")
			.filter((q) => q.lt(q.field("expiresAt"), Date.now()))
			.collect();

		for (const token of expiredTokens) {
			await ctx.db.delete(token._id);
		}

		return { deleted: expiredTokens.length };
	},
});
