/**
 * Centralized email configuration helper
 * Provides consistent fromAddress and replyToAddress across all email routes
 */

export function getEmailConfig() {
  const fromAddress =
    process.env.RESEND_FROM_EMAIL || "Proddy <support@proddy.tech>";
  const replyToAddress = process.env.SUPPORT_EMAIL || "support@proddy.tech";

  return {
    fromAddress,
    replyToAddress,
  };
}
