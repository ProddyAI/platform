import { ConvexHttpClient } from 'convex/browser';
import { api } from '../../convex/_generated/api';
import { type Id } from '../../convex/_generated/dataModel';
import { type EmailType, getNotificationKey } from './email-unsubscribe';

function getConvexClient() {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		throw new Error('NEXT_PUBLIC_CONVEX_URL environment variable is required');
	}
	return new ConvexHttpClient(convexUrl);
}

export async function shouldSendEmailServer(
	userId: Id<'users'>,
	emailType: EmailType
): Promise<boolean> {
	try {
		const convex = getConvexClient();

		const preferences = await convex.query(
			api.preferences.getNotificationPreferencesByUserId,
			{
				userId,
			}
		);

		if (!preferences) {
			return emailType !== 'weeklyDigest';
		}

		const notificationKey = getNotificationKey(emailType);
		const preferenceValue = preferences[notificationKey];

		// Handle the case where the preference might be a string (weeklyDigestDay) or boolean
		if (typeof preferenceValue === 'boolean') {
			return preferenceValue;
		}

		// For non-boolean values (like weeklyDigestDay), default to true
		return true;
	} catch (error) {
		console.error('Error checking email preferences:', error);
		// On error, default to allowing emails (except weekly digest) to avoid blocking important notifications
		return emailType !== 'weeklyDigest';
	}
}

/**
 * Update notification preferences for a user (server-side)
 */
export async function updateNotificationPreferencesServer(
	userId: Id<'users'>,
	emailType: EmailType,
	enabled: boolean
): Promise<boolean> {
	try {
		const convex = getConvexClient();
		const notificationKey = getNotificationKey(emailType);

		await convex.mutation(
			api.preferences.updateNotificationPreferencesByUserId,
			{
				userId: userId,
				notificationKey: emailType, // Use emailType directly since it matches the union type
				enabled,
			}
		);

		return true;
	} catch (error) {
		console.error('Error updating notification preferences:', error);
		return false;
	}
}
