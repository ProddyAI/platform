"use client";

import { useMutation } from "convex/react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface UseTrackActivityProps {
	workspaceId: Id<"workspaces"> | null;
	channelId?: Id<"channels"> | null;
	activityType?: string;
}

export const useTrackActivity = ({
	workspaceId,
	channelId,
	activityType = "page_view",
}: UseTrackActivityProps) => {
	const recordActivity = useMutation(api.analytics.recordUserActivity);
	const recordChannelSession = useMutation(api.analytics.recordChannelSession);
	const pathname = usePathname();
	const sessionIdRef = useRef<Id<"channelSessions"> | null>(null);
	const startTimeRef = useRef<number>(Date.now());
	const [isTracking, setIsTracking] = useState(false);

	// Record page view on mount
	useEffect(() => {
		if (!workspaceId) return;

		const recordPageView = async () => {
			try {
				await recordActivity({
					workspaceId,
					channelId: channelId || undefined,
					activityType,
					metadata: {
						path: pathname,
					},
				});
				setIsTracking(true);
			} catch (error) {
				console.error("Failed to record activity:", error);
			}
		};

		recordPageView();
	}, [workspaceId, channelId, activityType, pathname, recordActivity]);

	// Start channel session if channelId is provided
	useEffect(() => {
		if (!workspaceId || !channelId) return;

		const startSession = async () => {
			try {
				const sessionId = await recordChannelSession({
					workspaceId,
					channelId,
					action: "enter",
				});
				sessionIdRef.current = sessionId;
				startTimeRef.current = Date.now();
			} catch (error) {
				console.error("Failed to start channel session:", error);
			}
		};

		startSession();

		// End session on unmount
		return () => {
			if (sessionIdRef.current) {
				recordChannelSession({
					workspaceId,
					channelId,
					action: "exit",
					sessionId: sessionIdRef.current,
				}).catch((error) => {
					console.error("Failed to end channel session:", error);
				});
			}
		};
	}, [workspaceId, channelId, recordChannelSession]);

	// Track time spent on page
	useEffect(() => {
		if (!workspaceId) return;

		// Record time spent when user leaves the page
		const handleVisibilityChange = async () => {
			if (document.visibilityState === "hidden" && isTracking) {
				const duration = Date.now() - startTimeRef.current;
				try {
					await recordActivity({
						workspaceId,
						channelId: channelId || undefined,
						activityType: "time_spent",
						duration,
						metadata: {
							path: pathname,
						},
					});
				} catch (error) {
					console.error("Failed to record time spent:", error);
				}
			} else if (document.visibilityState === "visible") {
				// Reset start time when page becomes visible again
				startTimeRef.current = Date.now();
			}
		};

		// Record time spent when user navigates away
		const handleBeforeUnload = async () => {
			if (isTracking) {
				const duration = Date.now() - startTimeRef.current;
				try {
					await recordActivity({
						workspaceId,
						channelId: channelId || undefined,
						activityType: "time_spent",
						duration,
						metadata: {
							path: pathname,
						},
					});
				} catch (error) {
					console.error("Failed to record time spent:", error);
				}
			}
		};

		document.addEventListener("visibilitychange", handleVisibilityChange);
		window.addEventListener("beforeunload", handleBeforeUnload);

		return () => {
			document.removeEventListener("visibilitychange", handleVisibilityChange);
			window.removeEventListener("beforeunload", handleBeforeUnload);

			// Record final time spent when component unmounts
			if (isTracking) {
				const duration = Date.now() - startTimeRef.current;
				recordActivity({
					workspaceId,
					channelId: channelId || undefined,
					activityType: "time_spent",
					duration,
					metadata: {
						path: pathname,
					},
				}).catch((error) => {
					console.error("Failed to record final time spent:", error);
				});
			}
		};
	}, [workspaceId, channelId, pathname, isTracking, recordActivity]);

	return { isTracking };
};
