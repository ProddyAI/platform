"use client";

import { useMutation } from "convex/react";
import Script from "next/script";
import { useEffect, useRef } from "react";
import { api } from "@/../convex/_generated/api";
import { logger } from "@/lib/logger";

interface OneSignalTrackingProps {
	userId?: string;
}

type OneSignalInterface = any;

export const OneSignalTracking = ({ userId }: OneSignalTrackingProps) => {
	const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;
	const setOneSignalExternalId = useMutation(api.users.setOneSignalExternalId);
	const sdkLoadedRef = useRef(false);
	const initAttemptedRef = useRef(false);
	const currentUserRef = useRef<string | undefined>();
	const loginInFlightRef = useRef(false);

	// Wait for OneSignal SDK to be available on window
	const waitForOneSignal = async (
		maxWaitMs = 10000
	): Promise<OneSignalInterface | null> => {
		const startTime = Date.now();
		while (Date.now() - startTime < maxWaitMs) {
			if (window.OneSignal) {
				return window.OneSignal;
			}
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
		logger.error("OneSignal SDK not available after waiting");
		return null;
	};

	// ============================================================================
	// Initialize OneSignal SDK - runs once when component mounts
	// ============================================================================
	useEffect(() => {
		if (!appId) {
			logger.warn("No NEXT_PUBLIC_ONESIGNAL_APP_ID provided");
			return;
		}

		// Prevent multiple init attempts
		if (initAttemptedRef.current) {
			logger.debug("🔔 OneSignal init already attempted, skipping");
			return;
		}
		initAttemptedRef.current = true;

		const initializeOneSignal = async () => {
			try {
				const OneSignal = await waitForOneSignal();
				if (!OneSignal) {
					logger.error("❌ Failed to get OneSignal SDK");
					return;
				}

				// Check if already initialized by another instance
				if (
					OneSignal.User?.externalId ||
					(window as any).__oneSignalInitialized
				) {
					logger.debug("🔔 OneSignal already initialized");
					(window as any).__oneSignalInitialized = true;
					sdkLoadedRef.current = true;
					return;
				}

				logger.debug("🔔 Initializing OneSignal with config:", {
					appId,
					serviceWorkerPath: "/OneSignalSDKWorker.js",
					serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
				});

				await OneSignal.init({
					appId,
					serviceWorkerPath: "/OneSignalSDKWorker.js",
					serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
					serviceWorkerParam: { scope: "/" },
					allowLocalhostAsSecureOrigin: true,
				});

				(window as any).__oneSignalInitialized = true;
				sdkLoadedRef.current = true;
				logger.debug("✅ OneSignal SDK initialized successfully");
			} catch (error) {
				logger.error(
					"❌ OneSignal init failed:",
					error instanceof Error ? error.message : String(error)
				);
				sdkLoadedRef.current = false;
			}
		};

		initializeOneSignal();
	}, [appId]);

	// ============================================================================
	// Handle user login - runs when userId changes
	// ============================================================================
	useEffect(() => {
		if (!userId) return;

		// If no userId, skip
		if (!userId) {
			logger.debug("🔔 No userId provided, skipping login");
			currentUserRef.current = undefined;
			return;
		}

		// If same user already logged in, skip
		if (currentUserRef.current === userId) {
			logger.debug(`🔔 User ${userId} already logged in`);
			return;
		}

		if (loginInFlightRef.current) {
			logger.debug("🔔 OneSignal login skipped: login already in progress");
			return;
		}

		const loginUser = async () => {
			try {
				loginInFlightRef.current = true;
				// CRITICAL: Wait for init to complete before login
				// This is essential - init must finish before login can run
				let initCompleted = sdkLoadedRef.current;
				let waitAttempts = 0;
				const maxWaitMs = 15000;
				const startTime = Date.now();

				while (!initCompleted && Date.now() - startTime < maxWaitMs) {
					waitAttempts++;
					console.log(
						`⏳ [OneSignal Login] Waiting for init to complete (attempt ${waitAttempts})...`
					);
					await new Promise((resolve) => setTimeout(resolve, 100));
					initCompleted = sdkLoadedRef.current;
				}

				if (!initCompleted) {
					logger.error("❌ OneSignal init did not complete, aborting login");
					return;
				}


				// Now check SDK is available
				const OneSignal: any = window.OneSignal as any;
				if (!OneSignal) {
					logger.error("❌ OneSignal not available on window");
					return;
				}

				// Safety check: final verification userId is still valid
				if (!userId || typeof userId !== "string") {
					logger.error(`❌ userId is invalid: ${userId}`);
					return;
				}

				logger.debug(`🔔 Logging in user: ${userId}`);

				// Call login
				await OneSignal.login(userId);
				logger.debug(`✅ OneSignal login call completed`);

				// Wait a bit for the SDK to update User object
				await new Promise((resolve) => setTimeout(resolve, 500));

				// Check external ID
				const externalId = OneSignal.User?.externalId;
				logger.debug("✅ OneSignal.User.externalId after login:", externalId);

				if (externalId === userId) {
					logger.debug(`✅ Login successful: ${userId}`);
					currentUserRef.current = userId;
					await setOneSignalExternalId({ externalId: userId });
				} else {
					logger.warn(`⚠️ External ID mismatch. Expected ${userId}, got ${externalId}`);
					if (externalId) {
						await setOneSignalExternalId({ externalId });
					}
				}

				// Check and request push subscription
				const subscriptionStatus = OneSignal.User?.PushSubscription?.optedIn;

				if (!subscriptionStatus) {
					try {
						// Request push subscription
						await OneSignal.User.PushSubscription.optIn();
						logger.debug("✅ Push subscription opt-in requested");

						// Wait a moment for it to process
						await new Promise((resolve) => setTimeout(resolve, 500));

						// Check new status
						const newStatus = OneSignal.User?.PushSubscription?.optedIn;
						logger.debug("📱 Push subscription after opt-in:", newStatus);
					} catch (subError) {
						logger.warn("⚠️ Push subscription opt-in request failed");
					}
				}
			} catch (error) {
				const errorMsg = error instanceof Error ? error.message : String(error);
				logger.error(`❌ OneSignal login error:`, errorMsg);
			} finally {
				loginInFlightRef.current = false;
			}
		};
		loginUser();
	}, [setOneSignalExternalId, userId]);

	// ============================================================================
	// Handle user logout
	// ============================================================================
	useEffect(() => {
		// Only handle logout transitions (when userId becomes undefined)
		if (userId !== undefined) {
			return; // User is still logged in
		}

		// If we had a user but now it's gone, logout
		if (currentUserRef.current === undefined) {
			return; // Never had a user
		}

		const logoutUser = async () => {
			try {
				const OneSignal = window.OneSignal;
				if (!OneSignal) {
					logger.debug("OneSignal not available, skipping logout");
					return;
				}

				logger.debug("Logging out user");
				await OneSignal.logout();
				currentUserRef.current = undefined;
				await setOneSignalExternalId({ externalId: undefined });
				logger.debug("Logout successful");
			} catch (error) {
				logger.error(
					"OneSignal logout error:",
					error instanceof Error ? error.message : String(error)
				);
			}
		};

		logoutUser();
	}, [setOneSignalExternalId, userId]);

	if (!appId) {
		return null;
	}

	return (
		<Script
			id="onesignal-sdk"
			onError={() => {
				logger.error("❌ OneSignal SDK script failed to load from CDN");
				sdkLoadedRef.current = false;
			}}
			onLoad={() => {
				logger.debug("🔔 OneSignal SDK script loaded from CDN");
			}}
			src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
			strategy="afterInteractive"
		/>
	);
};
