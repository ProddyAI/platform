"use client";

import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { OneSignalTracking } from "./onesignal";

/**
 * Wrapper component that only renders OneSignal tracking after user authentication.
 * This prevents the notification prompt from appearing on public pages like sign-in/sign-up.
 * Passes currentUser to child component to avoid duplicate hook calls.
 */
export const AuthenticatedOneSignalTracking = () => {
	const { data: currentUser, isLoading } = useCurrentUser();

	// Debug logging
	if (typeof window !== "undefined") {
		console.log("🔍 [AuthenticatedOneSignalTracking] isLoading:", isLoading);
		console.log(
			"🔍 [AuthenticatedOneSignalTracking] currentUser exists:",
			!!currentUser
		);
		if (currentUser) {
			console.log(
				"🔥 [AuthenticatedOneSignalTracking] currentUser._id:",
				currentUser._id
			);
		}
	}

	// Don't render OneSignal until we know the auth state
	if (isLoading) {
		console.log(
			"⏳ [AuthenticatedOneSignalTracking] Auth state loading, not rendering OneSignal yet"
		);
		return null;
	}

	// Only render OneSignal for authenticated users
	if (!currentUser) {
		console.log(
			"❌ [AuthenticatedOneSignalTracking] No currentUser, not rendering OneSignal"
		);
		return null;
	}

	// Safety check: ensure userId exists
	if (!currentUser._id) {
		console.error(
			"❌ [AuthenticatedOneSignalTracking] currentUser exists but _id is undefined!"
		);
		return null;
	}

	console.log(
		"✅ [AuthenticatedOneSignalTracking] Rendering OneSignal with userId:",
		currentUser._id
	);
	return <OneSignalTracking userId={currentUser._id} />;
};
