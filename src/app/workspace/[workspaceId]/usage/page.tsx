"use client";

import { Activity } from "lucide-react";
import { useRouter } from "next/navigation";
import { PageShell } from "@/components/page-shell";
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
		<PageShell>
			<UsageDashboard
				onUpgradeClick={() =>
					router.push(`/workspace/${workspaceId}/manage#billing`)
				}
				workspaceId={workspaceId}
			/>
		</PageShell>
	);
}
