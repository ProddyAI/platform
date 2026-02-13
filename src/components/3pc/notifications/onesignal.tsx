"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

// Use the OneSignalInterface type from global.d.ts for proper typing
declare const OneSignal: OneSignalInterface;

type OneSignalDeferredCallback = (OneSignal: OneSignalInterface) => void | Promise<void>;

declare global {
	interface Window {
		OneSignalDeferred?: OneSignalDeferredCallback[];
	}
}

interface OneSignalTrackingProps {
	userId?: string;
}

export const OneSignalTracking = ({ userId }: OneSignalTrackingProps) => {
	const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
	const initializedRef = useRef(false);

	useEffect(() => {
		if (!appId || initializedRef.current) return;

		window.OneSignalDeferred = window.OneSignalDeferred || [];

		window.OneSignalDeferred.push(async (OneSignal: OneSignalInterface) => {
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
		if (!userId) return;

		window.OneSignalDeferred = window.OneSignalDeferred || [];

		window.OneSignalDeferred.push(async (OneSignal: OneSignalInterface) => {
			await OneSignal.login(userId);
			if (process.env.NODE_ENV === "development") {
				logger.debug("OneSignal user logged in");
			}
		});

		// Cleanup: logout when userId changes (e.g., on sign-out)
		return () => {
			window.OneSignalDeferred = window.OneSignalDeferred || [];
			window.OneSignalDeferred.push(async (OneSignal: OneSignalInterface) => {
				await OneSignal.logout();
				if (process.env.NODE_ENV === "development") {
					logger.debug("OneSignal user logged out");
				}
			});
		};
	}, [userId]);

	if (!appId) return null;

	return (
		<Script
			src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
			strategy="afterInteractive"
		/>
	);
};
