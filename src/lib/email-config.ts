/**
 * Centralized email configuration helper
 * Provides consistent fromAddress and replyToAddress across all email routes
 */

export function getEmailConfig() {
	// Prefer the server-only sender env var, but keep backward compatibility
	// with the older NEXT_PUBLIC_RESEND_FROM_EMAIL name used in legacy flows.
	// As a final fallback, use support inbox when configured.
	const fromAddress = process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL!;

	const replyToAddress =
		process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL ?? fromAddress;

	return {
		fromAddress,
		replyToAddress,
	};
}
