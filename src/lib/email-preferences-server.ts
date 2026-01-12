import { ConvexHttpClient } from "convex/browser";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { type EmailType, getNotificationKey } from "./email-unsubscribe";

function getConvexClient() {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(convexUrl);
}

export async function shouldSendEmailServer(
	userId: Id<"users">,
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
			return emailType !== "weeklyDigest";
		}

		const notificationKey = getNotificationKey(emailType);
		const preferenceValue = preferences[notificationKey];

		if (typeof preferenceValue === "boolean") {
			return preferenceValue;
		}

		return true;
	} catch (error) {
		console.error("Error checking email preferences:", error);
		return emailType !== "weeklyDigest";
	}
}

export async function updateNotificationPreferencesServer(
	userId: Id<"users">,
	emailType: EmailType,
	enabled: boolean
): Promise<boolean> {
	try {
		const convex = getConvexClient();
		const _notificationKey = getNotificationKey(emailType);

		await convex.mutation(
			api.preferences.updateNotificationPreferencesByUserId,
			{
				userId: userId,
				notificationKey: emailType,
				enabled,
			}
		);

		return true;
	} catch (error) {
		console.error("Error updating notification preferences:", error);
		return false;
	}
}
