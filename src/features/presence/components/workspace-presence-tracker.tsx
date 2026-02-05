"use client";

import { useMutation } from "convex/react";
import { useEffect, useCallback, useRef } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface WorkspacePresenceTrackerProps {
	workspaceId: Id<"workspaces">;
	children: React.ReactNode;
}

export const WorkspacePresenceTracker = ({
	workspaceId,
	children,
}: WorkspacePresenceTrackerProps) => {
	const workspaceHeartbeat = useMutation(api.presence.workspaceHeartbeat);
	const sessionIdRef = useRef(`session-${Date.now()}-${Math.random()}`);

	const sendHeartbeat = useCallback(() => {
		console.log("[WorkspacePresenceTracker] Sending heartbeat...", {
			workspaceId,
			sessionId: sessionIdRef.current,
			timestamp: new Date().toISOString(),
		});
		
		workspaceHeartbeat({
			workspaceId,
			sessionId: sessionIdRef.current,
			interval: 15000, // 15 seconds
		})
			.then((result) => {
				console.log("[WorkspacePresenceTracker] Heartbeat successful:", result);
			})
			.catch((error) => {
				console.error("[WorkspacePresenceTracker] Heartbeat failed:", error);
				console.error(
					"Check: 1) Are you authenticated? 2) Is status tracking enabled in settings?"
				);
			});
	}, [workspaceId, workspaceHeartbeat]);

	useEffect(() => {
		console.log(
			"[WorkspacePresenceTracker] Component mounted, starting heartbeat",
			{
				workspaceId,
				sessionId: sessionIdRef.current,
			}
		);

		// Send heartbeat immediately
		sendHeartbeat();

		// Set up interval for regular heartbeats every 15 seconds
		const interval = setInterval(sendHeartbeat, 15000);

		// Cleanup on unmount
		return () => {
			console.log("[WorkspacePresenceTracker] Component unmounting, stopping heartbeat");
			clearInterval(interval);
		};
	}, [sendHeartbeat, workspaceId]);

	return <>{children}</>;
};
