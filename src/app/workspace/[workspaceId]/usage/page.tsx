"use client";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { UsageDashboard } from "@/features/usage/components/UsageDashboard";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { WorkspaceToolbar } from "../toolbar";

export default function UsagePage() {
	const workspaceId = useWorkspaceId();
	const router = useRouter();

	return (
		<div className="flex h-full flex-col">
			<WorkspaceToolbar>
				<h1 className="group flex w-auto items-center overflow-hidden px-3 py-2 text-lg font-semibold text-white transition-standard hover:bg-white/10">
					<Activity className="mr-2 size-5" />
					<span className="truncate">Usage</span>
				</h1>
			</WorkspaceToolbar>
			<div className="flex-1 overflow-y-auto bg-[#f6f8fb] px-4 py-5 dark:bg-background sm:px-6 sm:py-7">
				<div className="mx-auto max-w-7xl">
					<UsageDashboard
						onUpgradeClick={() =>
							router.push(`/workspace/${workspaceId}/manage#billing`)
						}
						workspaceId={workspaceId}
					/>
				</div>
			</div>
		</div>
	);
}
