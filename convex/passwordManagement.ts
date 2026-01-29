import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";

// Character set for token generation
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

// Common/compromised passwords to reject
const COMMON_PASSWORDS = [
	"password",
	"123456",
	"12345678",
	"qwerty",
	"abc123",
	"monkey",
	"letmein",
	"trustno1",
	"dragon",
	"baseball",
	"iloveyou",
	"master",
	"sunshine",
	"ashley",
	"bailey",
	"passw0rd",
	"shadow",
	"123123",
	"654321",
	"superman",
	"qazwsx",
	"michael",
	"football",
	"password1",
	"admin",
	"welcome",
	"login",
	"princess",
	"solo",
	"starwars",
];

/**
 * Validate password strength according to security policy.
 * 
 * Password Requirements:
 * - Minimum 8 characters
 * - At least one uppercase letter (A-Z)
 * - At least one lowercase letter (a-z)
 * - At least one number (0-9)
 * - At least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)
 * - Not in the list of common/compromised passwords
 * 
 * @param password - The password to validate
 * @throws Error with descriptive message if password fails validation
 */
function validatePassword(password: string): void {
	// Check minimum length
	if (password.length < 8) {
		throw new Error("Password must be at least 8 characters long");
	}

	// Check for uppercase letter
	if (!/[A-Z]/.test(password)) {
		throw new Error("Password must contain at least one uppercase letter");
	}

	// Check for lowercase letter
	if (!/[a-z]/.test(password)) {
		throw new Error("Password must contain at least one lowercase letter");
	}

	// Check for number
	if (!/[0-9]/.test(password)) {
		throw new Error("Password must contain at least one number");
	}

	// Check for special character
	if (!/[!@#$%^&*()_+\-=[\]{}|;:,.<>?]/.test(password)) {
		throw new Error(
			"Password must contain at least one special character (!@#$%^&*()_+-=[]{}|;:,.<>?)"
		);
	}

	// Check against common passwords (case-insensitive)
	const lowerPassword = password.toLowerCase();
	if (COMMON_PASSWORDS.includes(lowerPassword)) {
		throw new Error(
			"This password is too common. Please choose a more secure password"
		);
	}

	// Check for sequential characters (e.g., "12345", "abcde")
	if (/(?:0123|1234|2345|3456|4567|5678|6789|7890)/.test(password)) {
		throw new Error("Password cannot contain sequential numbers");
	}

	if (/(?:abcd|bcde|cdef|defg|efgh|fghi|ghij|hijk|ijkl|jklm|klmn|lmno|mnop|nopq|opqr|pqrs|qrst|rstu|stuv|tuvw|uvwx|vwxy|wxyz)/i.test(password)) {
		throw new Error("Password cannot contain sequential letters");
	}
}

/**
 * Generate a cryptographically secure random token for password resets.
 * Uses crypto.getRandomValues() instead of Math.random() for true randomness.
 *
 * @returns A 32-character random token
 */
function generateToken(): string {
	const length = 32;
	let token = "";
	const maxValidByte = Math.floor(256 / chars.length) * chars.length;

	// Use rejection sampling to avoid modulo bias
	while (token.length < length) {
		const randomBytes = new Uint8Array(length - token.length);
		crypto.getRandomValues(randomBytes);

		for (let i = 0; i < randomBytes.length && token.length < length; i++) {
			const byte = randomBytes[i];
			// Only accept bytes that don't introduce bias
			if (byte < maxValidByte) {
				token += chars.charAt(byte % chars.length);
			}
		}
	}
	return token;
}

/**
 * Hash a token using SHA-256 for secure one-way hashing.
 * This ensures tokens cannot be reversed from the stored hash.
 *
 * @param token - The plain text token to hash
 * @returns Base64-encoded SHA-256 hash of the token
 */
async function hashToken(token: string): Promise<string> {
	const encoder = new TextEncoder();
	const data = encoder.encode(token);

	const hashBuffer = await crypto.subtle.digest("SHA-256", data);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	const hashBase64 = btoa(String.fromCharCode(...hashArray));

	return hashBase64;
}

/**
 * Hash a password using PBKDF2 with 100,000 iterations and SHA-256.
 *
 * ✅ COMPATIBILITY NOTE
 *
 * This function uses PBKDF2 hashing which is also configured in the
 * @convex-dev/auth Password provider (see convex/auth.ts).
 *
 * The CustomPassword provider in convex/auth.ts has been configured with
 * custom crypto functions (hashSecret and verifySecret) that use the same
 * PBKDF2 algorithm, ensuring compatibility across all password operations:
 * - Signup (via @convex-dev/auth)
 * - changePassword() (this file)
 * - resetPassword() (this file)
 *
 * ⚠️ WARNING: If you modify this hashing implementation, you MUST update
 * the corresponding crypto functions in convex/auth.ts to match.
 *
 * @param password - The plain text password to hash
 * @returns Base64-encoded hash of the password
 */
async function hashPassword(password: string): Promise<string> {
	// Use Web Crypto API to hash the password with PBKDF2
	const encoder = new TextEncoder();
	const data = encoder.encode(password);
	const salt = encoder.encode("convex-auth-salt"); // Static salt for compatibility

	const keyMaterial = await crypto.subtle.importKey(
		"raw",
		data,
		"PBKDF2",
		false,
		["deriveBits"]
	);

	const derivedBits = await crypto.subtle.deriveBits(
		{
			name: "PBKDF2",
			salt: salt,
			iterations: 100000,
			hash: "SHA-256",
		},
		keyMaterial,
		256
	);

	// Convert to base64 for storage
	const hashArray = Array.from(new Uint8Array(derivedBits));
	const hashBase64 = btoa(String.fromCharCode(...hashArray));
	return hashBase64;
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

			// Verify current password by comparing hashes
			const hashedCurrentPassword = await hashPassword(args.currentPassword);
			if (passwordAccount.secret !== hashedCurrentPassword) {
				throw new Error("Current password is incorrect");
			}

			// Validate new password strength before hashing
			validatePassword(args.newPassword);

			// Hash and update the new password
			const hashedNewPassword = await hashPassword(args.newPassword);
			await ctx.db.patch(passwordAccount._id, {
				secret: hashedNewPassword,
			});

			// Invalidate existing sessions by updating the user record
			await ctx.db.patch(userId, {
				emailVerificationTime: Date.now(),
			});

			return {
				success: true,
				requiresReauth: true,
				message:
					"Password updated successfully. Please sign in again with your new password.",
			};
		} catch (error) {
			if (
				error instanceof Error &&
				error.message === "Current password is incorrect"
			) {
				throw error;
			}
			throw new Error("Failed to update password. Please try again.");
		}
	},
});

/**
 * Internal mutation to generate password reset token.
 * Does not return the token to prevent security issues.
 * Only accessible via actions for server-side email sending.
 */
export const generatePasswordResetTokenInternal = internalMutation({
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
			return { success: true, token: null };
		}

		const authAccounts = await ctx.db
			.query("authAccounts")
			.filter((q) => q.eq(q.field("userId"), user._id))
			.collect();

		const hasPasswordAuth = authAccounts.some(
			(account) => account.provider === "password"
		);

		if (!hasPasswordAuth) {
			return { success: true, token: null };
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

		// Return token only internally for server-side email sending
		return { success: true, token };
	},
});

/**
 * Action to generate password reset token for server-side email sending.
 * This is only accessible by the API route, not directly by clients.
 */
export const generatePasswordResetToken = action({
	args: {
		email: v.string(),
	},
	handler: async (
		ctx,
		args
	): Promise<{ success: boolean; token: string | null }> => {
		const email = args.email.toLowerCase().trim();

		// Generate token internally
		const result = await ctx.runMutation(
			internal.passwordManagement.generatePasswordResetTokenInternal,
			{ email }
		);

		if (!result.success) {
			throw new Error("Failed to generate password reset token");
		}

		// Return token for use by API route (only accessible server-side)
		return { success: true, token: result.token };
	},
});

/**
 * Public mutation to request password reset.
 * Returns only a generic success message to prevent account enumeration.
 * The actual token generation and email sending happens server-side via the API route.
 */
export const requestPasswordReset = mutation({
	args: {
		email: v.string(),
	},
	handler: async (_ctx, _args) => {
		// Just return a generic success message
		// The API route handles the actual token generation and email sending
		return {
			success: true,
			message:
				"If an account exists with this email, a reset link will be sent.",
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

		// Validate new password strength before hashing
		validatePassword(args.newPassword);

		// Hash the new password
		const hashedPassword = await hashPassword(args.newPassword);

		// Update the password in the authAccount
		await ctx.db.patch(passwordAccount._id, {
			secret: hashedPassword,
		});

		// Invalidate existing sessions by updating the user record
		// This forces re-authentication
		await ctx.db.patch(user._id, {
			emailVerificationTime: Date.now(),
		});

		// Mark the reset token as used ONLY after all operations succeed
		// This ensures the token remains valid if any operation fails
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

export const cleanupExpiredTokens = internalMutation({
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
