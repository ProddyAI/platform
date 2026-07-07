"use client";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { UsageDashboard } from "@/features/usage/components/usage-dashboard";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import {
	useSetWorkspaceTitle,
	WorkspaceTitle,
} from "../workspace-title-context";

export default function UsagePage() {
	useSetWorkspaceTitle(<WorkspaceTitle icon={Activity} label="Usage" />);

	const workspaceId = useWorkspaceId();
	const router = useRouter();
	if (!workspaceId) return null;

	return (
		<div className="flex h-full flex-col">
			<div className="flex-1 overflow-y-auto bg-muted px-4 py-5 dark:bg-background sm:px-6 sm:py-7">
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
