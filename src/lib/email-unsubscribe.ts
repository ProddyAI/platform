import crypto from "node:crypto";

export type EmailType =
	| "mentions"
	| "assignee"
	| "threadReply"
	| "directMessage"
	| "weeklyDigest";

function getUnsubscribeSecret(): string {
	return process.env.NEXT_PUBLIC_EMAIL_UNSUBSCRIBE_SECRET!;
}

export function generateUnsubscribeUrl(
	userId: string,
	emailType: EmailType
): string {
	const secret = getUnsubscribeSecret();
	const timestamp = Date.now().toString();

	const data = `${userId}:${emailType}:${timestamp}`;

	const signature = crypto
		.createHmac("sha256", secret)
		.update(data)
		.digest("hex");

	const baseUrl = process.env.NEXT_PUBLIC_APP_URL;
	const params = new URLSearchParams({
		userId,
		emailType,
		timestamp,
		signature,
	});

	return `${baseUrl}/api/email/unsubscribe?${params.toString()}`;
}

/**
 * Verify an unsubscribe URL signature
 */
export function verifyUnsubscribeSignature(
	userId: string,
	emailType: EmailType,
	timestamp: string,
	signature: string
): { valid: boolean; error?: string } {
	try {
		const secret = getUnsubscribeSecret();

		const timestampNum = parseInt(timestamp, 10);
		const now = Date.now();
		const sevenDaysInMs = 7 * 24 * 60 * 60 * 1000;

		if (now - timestampNum > sevenDaysInMs) {
			return { valid: false, error: "Unsubscribe link has expired" };
		}

		const data = `${userId}:${emailType}:${timestamp}`;

		const expectedSignature = crypto
			.createHmac("sha256", secret)
			.update(data)
			.digest("hex");

		const isValid = crypto.timingSafeEqual(
			new Uint8Array(Buffer.from(signature, "hex")),
			new Uint8Array(Buffer.from(expectedSignature, "hex"))
		);

		if (!isValid) {
			return { valid: false, error: "Invalid unsubscribe signature" };
		}

		return { valid: true };
	} catch {
		return { valid: false, error: "Failed to verify unsubscribe signature" };
	}
}

export function getEmailTypeName(emailType: EmailType): string {
	const names: Record<EmailType, string> = {
		mentions: "Mention notifications",
		assignee: "Task assignment notifications",
		threadReply: "Thread reply notifications",
		directMessage: "Direct message notifications",
		weeklyDigest: "Weekly digest emails",
	};

	return names[emailType] || emailType;
}

/**
 * Get the corresponding notification preference key for an email type
 */
export function getNotificationKey(
	emailType: EmailType
): keyof NotificationPreferences {
	const keyMap: Record<EmailType, keyof NotificationPreferences> = {
		mentions: "mentions",
		assignee: "assignee",
		threadReply: "threadReply",
		directMessage: "directMessage",
		weeklyDigest: "weeklyDigest",
	};

	return keyMap[emailType];
}

// Type for notification preferences (matching the Convex schema)
export interface NotificationPreferences {
	mentions: boolean;
	assignee: boolean;
	threadReply: boolean;
	directMessage: boolean;
	weeklyDigest: boolean;
	weeklyDigestDay:
		| "monday"
		| "tuesday"
		| "wednesday"
		| "thursday"
		| "friday"
		| "saturday"
		| "sunday";
}

/**
 * Check if a user should receive a specific email type
 * This function should be called before sending any email
 */
export async function shouldSendEmail(
	userId: string,
	emailType: EmailType,
	convexClient: any // ConvexHttpClient or similar
): Promise<boolean> {
	try {
		// Import the API here to avoid circular dependencies
		const { api } = await import("../../convex/_generated/api");

		// Get user notification preferences
		const preferences = await convexClient.query(
			api.preferences.getNotificationPreferencesByUserId,
			{
				userId,
			}
		);

		if (!preferences) {
			// If no preferences found, default to allowing emails (except weekly digest)
			return emailType !== "weeklyDigest";
		}

		const notificationKey = getNotificationKey(emailType);
		return preferences[notificationKey] ?? true;
	} catch (error) {
		return emailType !== "weeklyDigest";
	}
}
