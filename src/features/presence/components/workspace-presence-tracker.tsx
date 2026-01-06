"use client";

import { useMutation } from "convex/react";
import { useEffect } from "react";
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

	useEffect(() => {
		// Generate a unique session ID
		const sessionId = `session-${Date.now()}-${Math.random()}`;

		// Send initial heartbeat
		const sendHeartbeat = () => {
			workspaceHeartbeat({
				workspaceId,
				sessionId,
				interval: 30000, // 30 seconds
			}).catch(console.error);
		};

		// Send heartbeat immediately
		sendHeartbeat();

		// Set up interval for regular heartbeats
		const interval = setInterval(sendHeartbeat, 30000);

		// Cleanup on unmount
		return () => {
			clearInterval(interval);
		};
	}, [workspaceId, workspaceHeartbeat]);

	return <>{children}</>;
};
