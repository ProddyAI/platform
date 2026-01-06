"use client";

import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { useGetLastActiveWorkspace } from "@/features/workspaces/api/use-get-last-active-workspace";
import { useGetWorkspaces } from "@/features/workspaces/api/use-get-workspaces";
import { useCreateWorkspaceModal } from "@/features/workspaces/store/use-create-workspace-modal";

const WorkspacePage = () => {
	const router = useRouter();
	const [open, setOpen] = useCreateWorkspaceModal();
	const { data: workspaces, isLoading: isLoadingWorkspaces } =
		useGetWorkspaces();
	const { data: lastActiveWorkspaceId, isLoading: isLoadingLastActive } =
		useGetLastActiveWorkspace();

	useEffect(() => {
		// Wait until both queries have completed
		if (isLoadingWorkspaces || isLoadingLastActive) return;

		if (workspaces?.length) {
			if (lastActiveWorkspaceId) {
				// If user has a last active workspace, redirect to dashboard
				router.replace(`/workspace/${lastActiveWorkspaceId}/dashboard`);
			} else {
				// If no last active workspace, redirect to the first one's dashboard
				router.replace(`/workspace/${workspaces[0]._id}/dashboard`);
			}
		} else if (!open) {
			// If user has no workspaces, open the create workspace modal
			setOpen(true);
		}
	}, [
		workspaces,
		isLoadingWorkspaces,
		lastActiveWorkspaceId,
		isLoadingLastActive,
		open,
		setOpen,
		router,
	]);

	return (
		<div className="bg-primary flex h-full flex-1 flex-col items-center justify-center gap-2 text-white">
			<Loader className="size-5 animate-spin" />
			<p className="text-sm">Loading your workspace...</p>
		</div>
	);
};

export default WorkspacePage;
