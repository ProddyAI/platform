"use client";

import { Activity } from "lucide-react";
import { UsageDashboard } from "@/features/usage/components/UsageDashboard";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

export default function UsagePage() {
	const workspaceId = useWorkspaceId();
	if (!workspaceId) return null;

	return (
		<div className="flex h-full flex-col">
			<WorkspaceToolbar>
				<h1 className="group w-auto overflow-hidden px-3 py-2 text-lg font-semibold text-white hover:bg-white/10 transition-standard">
					<Activity className="mr-2 size-5" />
					<span className="truncate">Usage</span>
				</h1>
			</WorkspaceToolbar>
			<div className="flex-1 overflow-y-auto px-6 py-6 bg-background">
				<div className="mx-auto max-w-4xl">
					<UsageDashboard workspaceId={workspaceId} />
				</div>
			</div>
		</div>
	);
}
