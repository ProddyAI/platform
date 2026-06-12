"use client";

import { Flag, KanbanSquare, Zap } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";

import { useProjectId } from "@/hooks/use-project-id";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { cn } from "@/lib/utils";

const TABS = [
	{ label: "Board", icon: KanbanSquare, segment: "board" },
	{ label: "Sprints", icon: Zap, segment: "sprints" },
	{ label: "Roadmap", icon: Flag, segment: "roadmap" },
] as const;

export const ProjectNavTabs = () => {
	const router = useRouter();
	const pathname = usePathname();
	const workspaceId = useWorkspaceId();
	const projectId = useProjectId();

	const activeSegment =
		TABS.find((tab) => pathname?.endsWith(`/${tab.segment}`))?.segment ??
		"board";

	const navigate = (segment: string) => {
		if (!workspaceId || !projectId) return;
		router.push(`/workspace/${workspaceId}/project/${projectId}/${segment}`);
	};

	return (
		<div className="flex items-center gap-1 border-b bg-background px-4">
			{TABS.map(({ label, icon: Icon, segment }) => {
				const isActive = activeSegment === segment;
				return (
					<button
						className={cn(
							"flex items-center gap-1.5 border-b-2 px-3 py-2.5 font-medium text-sm transition-colors",
							isActive
								? "border-primary text-primary"
								: "border-transparent text-muted-foreground hover:border-muted-foreground/40 hover:text-foreground"
						)}
						key={segment}
						onClick={() => navigate(segment)}
						type="button"
					>
						<Icon className="size-3.5" />
						{label}
					</button>
				);
			})}
		</div>
	);
};
