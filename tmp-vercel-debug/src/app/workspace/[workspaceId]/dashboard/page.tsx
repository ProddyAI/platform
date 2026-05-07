"use client";

import { LayoutDashboard, Loader } from "lucide-react";
import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { DashboardWidgets } from "@/features/dashboard/components/dashboard-widgets";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

const DashboardPage = () => {
	// Set document title
	useDocumentTitle("Dashboard");

	const workspaceId = useWorkspaceId();

	// Track user activity and time spent on dashboard
	useTrackActivity({
		workspaceId,
		activityType: "dashboard_view",
	});

	// Get current member to check permissions
	const { data: member, isLoading: memberLoading } = useCurrentMember({
		workspaceId,
	});

	// Get current user data
	const { data: currentUser, isLoading: userLoading } = useCurrentUser();

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

	if (!workspaceId || memberLoading || userLoading || !enhancedMember) {
		return (
			<div className="flex h-full items-center justify-center">
				<Loader className="size-6 animate-spin text-muted-foreground" />
			</div>
		);
	}

	return (
		<div className="flex h-full flex-col">
			<WorkspaceToolbar>
				<Button
					className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard"
					size="sm"
					variant="ghost"
				>
					<LayoutDashboard className="mr-2 size-5" />
					<span className="truncate">Dashboard</span>
				</Button>
			</WorkspaceToolbar>
			<div className="flex flex-1 overflow-hidden p-4 md:p-6">
				<div className="flex w-full flex-col">
					{/* Full-width Widgets section */}
					<DashboardWidgets member={enhancedMember} workspaceId={workspaceId} />
				</div>
			</div>
		</div>
	);
};

export default DashboardPage;
