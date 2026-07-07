"use client";

import { Bot, Loader } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useMemo } from "react";
import { useCurrentUser } from "@/features/auth/api/use-current-user";
import { DashboardChatbot } from "@/features/dashboard/components/dashboard-chatbot";
import { useCurrentMember } from "@/features/members/api/use-current-member";
import { useTrackActivity } from "@/features/reports/hooks/use-track-activity";
import { useDocumentTitle } from "@/hooks/use-document-title";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

const AssistantPage = () => {
	// Set document title
	useDocumentTitle("Proddy AI");

	useSetWorkspaceTitle(<WorkspaceTitle icon={Bot} label="Proddy AI" />);

	const workspaceId = useWorkspaceId();

	const searchParams = useSearchParams();
	const initialPrompt = searchParams.get("prompt") ?? undefined;

	// Track user activity and time spent on assistant page
	useTrackActivity({
		workspaceId: workspaceId ?? null,
		activityType: "assistant_view",
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
			<div className="flex flex-1 overflow-hidden p-4 md:p-6">
				<div className="flex w-full flex-col">
					{/* Full-width Proddy AI Chatbot */}
					<DashboardChatbot
						initialPrompt={initialPrompt}
						member={enhancedMember}
						workspaceId={workspaceId}
					/>
				</div>
			</div>
		</div>
	);
};

export default AssistantPage;
