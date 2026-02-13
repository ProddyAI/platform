"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { logger } from "@/lib/logger";

declare global {
	interface Window {
		OneSignalDeferred?: Array<(OneSignal: any) => void>;
	}
}

export const OneSignalTracking = () => {
	const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
	const { data: currentUser } = useCurrentUser();
	const initializedRef = useRef(false);

	useEffect(() => {
		if (!appId || initializedRef.current) return;

		window.OneSignalDeferred = window.OneSignalDeferred || [];

		window.OneSignalDeferred.push(async (OneSignal: any) => {
			await OneSignal.init({
				appId,
				serviceWorkerPath: "/OneSignalSDK.sw.js",
				serviceWorkerParam: { scope: "/" },
			});

			if (process.env.NODE_ENV === "development") {
				logger.debug("OneSignal initialized");
			}
		});

		initializedRef.current = true;
	}, [appId]);

	useEffect(() => {
		if (!currentUser?._id) return;

		window.OneSignalDeferred = window.OneSignalDeferred || [];

		window.OneSignalDeferred.push(async (OneSignal: any) => {
			await OneSignal.login(currentUser._id);
			if (process.env.NODE_ENV === "development") {
				logger.debug("OneSignal user ID set:", currentUser._id);
			}
		});
	}, [currentUser?._id]);

	if (!appId) return null;

	return (
		<Script
			src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
			strategy="afterInteractive"
		/>
	);
};
