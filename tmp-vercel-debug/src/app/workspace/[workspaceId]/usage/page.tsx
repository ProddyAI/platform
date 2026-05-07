"use client";

import { Activity } from "lucide-react";
import { UsageDashboard } from "@/features/usage/components/UsageDashboard";
import { useWorkspaceId } from "@/hooks/use-workspace-id";

export default function UsagePage() {
	const workspaceId = useWorkspaceId();

	return (
		<div className="flex h-full flex-col">
			<div className="flex items-center gap-3 border-b px-6 py-4">
				<Activity className="size-6 text-primary" />
				<h1 className="text-xl font-semibold">Usage</h1>
			</div>
			<div className="flex-1 overflow-y-auto px-6 py-6">
				<div className="mx-auto max-w-2xl">
					<UsageDashboard workspaceId={workspaceId} />
				</div>
			</div>
		</div>
	);
}
