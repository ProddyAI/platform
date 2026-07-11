"use client";

import { LayoutDashboard, Loader } from "lucide-react";
import { useMemo } from "react";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { DashboardWidgets } from "@/features/dashboard/components/dashboard-widgets";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const DashboardContent = () => {
	// Set document title
	useDocumentTitle("Dashboard");

	const workspaceId = useWorkspaceId();

	// Track user activity and time spent on dashboard
	useTrackActivity({
		workspaceId: workspaceId ?? null,
		activityType: "dashboard_view",
	});

	// Get current member to check permissions
	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});

	// Get current user data
	const { data: currentUser, isLoading: userLoading } = useCurrentUser();

	// First name only, so the greeting stays short — falls back to the plain
	// "Dashboard" label when no name is available rather than fabricating one.
	const firstName = currentUser?.name?.trim().split(/\s+/)[0];

	useSetWorkspaceTitle(
		<WorkspaceTitle
			icon={LayoutDashboard}
			label={firstName ? `Welcome back, ${firstName} 👋` : "Dashboard"}
		/>
	);

	// Create enhanced member object with user data
	const enhancedMember = useMemo(() => {
		if (!member || !currentUser) return null;

		return {
			_id: member._id,
			userId: member.userId,
			role: member.role as string,
			workspaceId: member.workspaceId,
			user: {
				name: currentUser.name || "User",
				image: currentUser.image || undefined,
			},
		};
	}, [member, currentUser]);

	if (memberLoading || userLoading) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	if (currentUser === null) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-y-4">
				<p className="text-sm text-muted-foreground">
					Your session has expired. Please sign in again.
				</p>
				<Button
					onClick={() => (window.location.href = "/auth/signin")}
					variant="outline"
				>
					Sign In
				</Button>
			</div>
		);
	}

	if (member === null) {
		return (
			<div className="flex h-full flex-col items-center justify-center gap-y-4">
				<p className="text-sm text-muted-foreground">
					You are not a member of this workspace.
				</p>
				<Button
					onClick={() => (window.location.href = "/workspace")}
					variant="outline"
				>
					Go to Workspaces
				</Button>
			</div>
		);
	}

	if (!workspaceId || !enhancedMember) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<PageShell>
			<DashboardWidgets member={enhancedMember} workspaceId={workspaceId} />
		</PageShell>
	);
};

export default DashboardContent;
