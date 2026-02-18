"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { logger } from "@/lib/logger";

interface OneSignalTrackingProps {
	userId?: string;
}

export const OneSignalTracking = ({ userId }: OneSignalTrackingProps) => {
	const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
	const initializedRef = useRef(false);
	const oneSignalLoadFailedRef = useRef(false);

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
		if (!userId || oneSignalLoadFailedRef.current) return;

		window.OneSignalDeferred = window.OneSignalDeferred || [];

		window.OneSignalDeferred.push(async (OneSignal: OneSignalInterface) => {
			await OneSignal.login(userId);
			if (process.env.NODE_ENV === "development") {
				logger.debug("OneSignal user logged in");
			}
		});

		// Cleanup: logout when userId changes (e.g., on sign-out)
		return () => {
			if (oneSignalLoadFailedRef.current) return;
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
			onError={() => {
				logger.warn("OneSignal SDK failed to load");
				oneSignalLoadFailedRef.current = true;
				const queuedCallbacks = window.OneSignalDeferred || [];
				window.OneSignalDeferred = [];
				for (const callback of queuedCallbacks) {
					try {
						callback({} as OneSignalInterface);
					} catch (_error) {
						logger.error(
							"OneSignal deferred callback failed after SDK load error"
						);
					}
				}
			}}
			src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
			strategy="afterInteractive"
		/>
	);
};
