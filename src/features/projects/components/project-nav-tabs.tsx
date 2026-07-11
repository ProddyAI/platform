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
		<div className="flex items-center border-b bg-background px-4 py-2">
			<div className="inline-flex items-center gap-1 rounded-full bg-muted p-1">
				{TABS.map(({ label, icon: Icon, segment }) => {
					const isActive = activeSegment === segment;
					return (
						<button
							aria-current={isActive ? "page" : undefined}
							className={cn(
								"flex items-center gap-1.5 rounded-full px-3.5 py-1.5 font-medium text-sm transition-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
								isActive
									? "bg-card text-foreground shadow-sm"
									: "text-muted-foreground hover:text-foreground"
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
		</div>
	);
};
