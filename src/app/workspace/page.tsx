"use client";

import { Loader } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useConvexAuth } from "convex/react";

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
	const { isAuthenticated, isLoading: isAuthLoading } = useConvexAuth();

	useEffect(() => {
		if (!isAuthLoading && !isAuthenticated) {
			router.replace("/auth/signin");
		}
	}, [isAuthenticated, isAuthLoading, router]);

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
		<div className="bg-primary flex h-full flex-1 flex-col items-center justify-center gap-4 text-white p-8">
			<Loader className="size-8 animate-spin mb-4" />
			<p className="text-xl font-bold">Loading your workspace...</p>
			
			<div className="mt-8 flex flex-col items-center gap-4">
				<p className="text-sm text-white/70">Taking too long?</p>
				<div className="flex gap-4">
					<button 
						onClick={() => setOpen(true)}
						className="px-4 py-2 bg-white text-primary rounded-md font-medium text-sm hover:bg-white/90"
					>
						Create New Workspace
					</button>
					<button 
						onClick={() => window.location.href = "/auth/signin"}
						className="px-4 py-2 bg-white/20 text-white rounded-md font-medium text-sm hover:bg-white/30"
					>
						Back to Sign In
					</button>
				</div>
			</div>

			<div className="bg-black/50 p-4 rounded-md text-xs text-left w-full max-w-md font-mono mt-8 space-y-1">
				<p>Debug Info:</p>
				<p>isLoadingWorkspaces: {String(isLoadingWorkspaces)}</p>
				<p>workspaces count: {workspaces?.length ?? 'undefined'}</p>
				<p>isLoadingLastActive: {String(isLoadingLastActive)}</p>
				<p>lastActiveId: {lastActiveWorkspaceId ?? 'null'}</p>
				<p>open modal state: {String(open)}</p>
				<p>isAuthLoading: {String(isAuthLoading)}</p>
				<p>isAuthenticated: {String(isAuthenticated)}</p>
			</div>
		</div>
	);
};

export default WorkspacePage;
