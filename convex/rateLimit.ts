import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

/**
 * Rate limit configurations
 */
const RATE_LIMITS = {
	// Per user: 10 invites per hour
	USER_INVITES_PER_HOUR: 10,
	USER_WINDOW_MS: 60 * 60 * 1000, // 1 hour

	// Per workspace: 20 invites per hour
	WORKSPACE_INVITES_PER_HOUR: 20,
	WORKSPACE_WINDOW_MS: 60 * 60 * 1000, // 1 hour

	// Per email recipient: 5 invites per day (prevent spam to same email)
	EMAIL_INVITES_PER_DAY: 5,
	EMAIL_WINDOW_MS: 24 * 60 * 60 * 1000, // 24 hours
};

/**
 * Check if a user/workspace/email has exceeded rate limits
 */
export const checkRateLimit = query({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const now = Date.now();
		const normalizedEmail = args.email.toLowerCase();

		// Check user rate limit
		const userLimits = await ctx.db
			.query("rateLimits")
			.withIndex("by_user_id", (q) => q.eq("userId", userId))
			.filter((q) =>
				q.and(
					q.eq(q.field("type"), "user_invite"),
					q.gt(q.field("expiresAt"), now)
				)
			)
			.collect();

		if (userLimits.length >= RATE_LIMITS.USER_INVITES_PER_HOUR) {
			const oldestExpiry = Math.min(...userLimits.map((l) => l.expiresAt));
			const minutesRemaining = Math.ceil((oldestExpiry - now) / 1000 / 60);
			return {
				allowed: false,
				reason: `Rate limit exceeded. You can send more invites in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
			};
		}

		// Check workspace rate limit
		const workspaceLimits = await ctx.db
			.query("rateLimits")
			.withIndex("by_workspace_id", (q) =>
				q.eq("workspaceId", args.workspaceId)
			)
			.filter((q) =>
				q.and(
					q.eq(q.field("type"), "workspace_invite"),
					q.gt(q.field("expiresAt"), now)
				)
			)
			.collect();

		if (workspaceLimits.length >= RATE_LIMITS.WORKSPACE_INVITES_PER_HOUR) {
			const oldestExpiry = Math.min(...workspaceLimits.map((l) => l.expiresAt));
			const minutesRemaining = Math.ceil((oldestExpiry - now) / 1000 / 60);
			return {
				allowed: false,
				reason: `Workspace rate limit exceeded. Try again in ${minutesRemaining} minute${minutesRemaining !== 1 ? "s" : ""}.`,
			};
		}

		// Check email rate limit (prevent spam to same recipient)
		const emailLimits = await ctx.db
			.query("rateLimits")
			.withIndex("by_email", (q) => q.eq("email", normalizedEmail))
			.filter((q) =>
				q.and(
					q.eq(q.field("type"), "email_invite"),
					q.gt(q.field("expiresAt"), now)
				)
			)
			.collect();

		if (emailLimits.length >= RATE_LIMITS.EMAIL_INVITES_PER_DAY) {
			const oldestExpiry = Math.min(...emailLimits.map((l) => l.expiresAt));
			const hoursRemaining = Math.ceil((oldestExpiry - now) / 1000 / 60 / 60);
			return {
				allowed: false,
				reason: `This email address has received too many invites. Try again in ${hoursRemaining} hour${hoursRemaining !== 1 ? "s" : ""}.`,
			};
		}

		return { allowed: true };
	},
});

/**
 * Record a rate limit entry after sending an invite
 */
export const recordRateLimit = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		email: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) {
			throw new Error("Unauthorized");
		}

		const now = Date.now();
		const normalizedEmail = args.email.toLowerCase();

		// Record user rate limit
		await ctx.db.insert("rateLimits", {
			userId,
			workspaceId: args.workspaceId,
			type: "user_invite",
			expiresAt: now + RATE_LIMITS.USER_WINDOW_MS,
			createdAt: now,
		});

		// Record workspace rate limit
		await ctx.db.insert("rateLimits", {
			userId,
			workspaceId: args.workspaceId,
			type: "workspace_invite",
			expiresAt: now + RATE_LIMITS.WORKSPACE_WINDOW_MS,
			createdAt: now,
		});

		// Record email rate limit
		await ctx.db.insert("rateLimits", {
			userId,
			workspaceId: args.workspaceId,
			email: normalizedEmail,
			type: "email_invite",
			expiresAt: now + RATE_LIMITS.EMAIL_WINDOW_MS,
			createdAt: now,
		});

		return { success: true };
	},
});

/**
 * Clean up expired rate limit entries (called by cron job)
 */
export const cleanupExpiredLimits = mutation({
	args: {},
	handler: async (ctx) => {
		const now = Date.now();

		const expiredLimits = await ctx.db
			.query("rateLimits")
			.filter((q) => q.lt(q.field("expiresAt"), now))
			.collect();

		for (const limit of expiredLimits) {
			await ctx.db.delete(limit._id);
		}

		return { deleted: expiredLimits.length };
	},
});

// Export as internal function for cron jobs
export { cleanupExpiredLimits as default };
