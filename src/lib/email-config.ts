/**
 * Centralized email configuration helper
 * Provides consistent fromAddress and replyToAddress across all email routes
 */

export function getEmailConfig() {
	const fromAddress =
		process.env.RESEND_FROM_EMAIL;
	const replyToAddress = process.env.NEXT_PUBLIC_SUPPORT_EMAIL;

	return {
		fromAddress,
		replyToAddress,
	};
}
