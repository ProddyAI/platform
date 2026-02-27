"use client";

import { useMutation } from "convex/react";
import { useCallback, useEffect, useRef } from "react";
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
		workspaceHeartbeat({
			workspaceId,
			sessionId: sessionIdRef.current,
			interval: 15000, // 15 seconds
		}).catch(() => {
			// Silently handle heartbeat errors
		});
	}, [workspaceId, workspaceHeartbeat]);

	useEffect(() => {
		// Send heartbeat immediately
		sendHeartbeat();

		// Set up interval for regular heartbeats every 15 seconds
		const interval = setInterval(sendHeartbeat, 15000);

		// Cleanup on unmount
		return () => {
			clearInterval(interval);
		};
	}, [sendHeartbeat]);

	return <>{children}</>;
};
