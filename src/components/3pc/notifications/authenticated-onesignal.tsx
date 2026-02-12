"use client";

import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { OneSignalTracking } from "./onesignal";

/**
 * Wrapper component that only renders OneSignal tracking after user authentication.
 * This prevents the notification prompt from appearing on public pages like sign-in/sign-up.
 */
export const AuthenticatedOneSignalTracking = () => {
	const { data: currentUser, isLoading } = useCurrentUser();

	// Don't render OneSignal until we know the auth state
	if (isLoading) {
		return null;
	}

	// Only render OneSignal for authenticated users
	if (!currentUser) {
		return null;
	}

	return <OneSignalTracking />;
};
