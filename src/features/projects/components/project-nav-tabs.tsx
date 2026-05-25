"use client";

import { usePathname, useRouter } from "next/navigation";
import { KanbanSquare, Zap, Flag } from "lucide-react";
import { cn } from "@/lib/utils";
import { useWorkspaceId } from "@/hooks/use-workspace-id";
import { useProjectId } from "@/hooks/use-project-id";

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
    const activeSegment = TABS.find((tab) => pathname?.endsWith(`/${tab.segment}`))?.segment ?? "board";

    const navigate = (segment: string) => {
        router.push(`/workspace/${workspaceId}/project/${projectId}/${segment}`);
    };

    return (
        <div className="flex items-center border-b bg-background px-4 gap-1">
            {TABS.map(({ label, icon: Icon, segment }) => {
                const isActive = activeSegment === segment;
                return (
                    <button key={segment} onClick={() => navigate(segment)}
                        className={cn("flex items-center gap-1.5 px-3 py-2.5 text-sm font-medium border-b-2 transition-colors",
                            isActive ? "border-primary text-primary" : "border-transparent text-muted-foreground hover:text-foreground hover:border-muted-foreground"
                        )}>
                        <Icon className="size-3.5" />
                        {label}
                    </button>
                );
            })}
        </div>
    );
};
