"use client";

import DOMPurify from "dompurify";
import { Network } from "lucide-react";
import type React from "react";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { formatIssueId } from "./board-issue-row";

interface BoardLinkageDiagramProps {
    channelId: Id<"channels">;
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const BoardLinkageDiagram: React.FC<BoardLinkageDiagramProps> = ({
    channelId,
    open,
    onOpenChange,
}) => {
    const issues = useQuery(api.board.getIssues, { channelId });
    const relationships = useQuery(
        api.board.getAllBlockingRelationshipsForChannel,
        { channelId }
    );

    const svgRef = useRef<HTMLDivElement>(null);
    const [svgContent, setSvgContent] = useState<string>("");
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!open || !issues || !relationships) return;

        // Only top-level issues in the diagram
        const topLevelIssues = issues.filter((i) => !i.parentIssueId);
        if (topLevelIssues.length === 0) {
            setSvgContent("");
            return;
        }

        const renderDiagram = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const mermaid = (await import("mermaid")).default;
                mermaid.initialize({
                    startOnLoad: false,
                    theme: "neutral",
                    flowchart: { useMaxWidth: true, htmlLabels: false },
                });

                // Map Convex ID → safe mermaid node id (n0, n1, ...)
                const idMap = new Map<string, string>();
                topLevelIssues.forEach((issue, idx) => {
                    idMap.set(issue._id, `n${idx}`);
                });

                const lines: string[] = ["flowchart LR"];

                // Emit nodes
                for (const issue of topLevelIssues) {
                    const nodeId = idMap.get(issue._id)!;
                    // Sanitize label: replace quotes and brackets that would break Mermaid syntax
                    const rawLabel = `${formatIssueId(issue._id)}: ${issue.title}`;
                    const label = rawLabel
                        .replace(/"/g, "'")
                        .replace(/[[\]{}]/g, "")
                        .slice(0, 60);
                    lines.push(`    ${nodeId}["${label}"]`);
                }

                // Emit edges
                for (const rel of relationships) {
                    const from = idMap.get(rel.blockingIssueId);
                    const to = idMap.get(rel.blockedIssueId);
                    if (from && to) {
                        lines.push(`    ${from} --> ${to}`);
                    }
                }

                const mermaidCode = lines.join("\n");
                const renderId = `linkage-${Date.now()}`;
                const { svg } = await mermaid.render(renderId, mermaidCode);

                const sanitized = DOMPurify.sanitize(svg, {
                    USE_PROFILES: { svg: true, svgFilters: true },
                    ALLOWED_TAGS: [
                        "svg",
                        "g",
                        "path",
                        "text",
                        "tspan",
                        "rect",
                        "circle",
                        "ellipse",
                        "line",
                        "polyline",
                        "polygon",
                        "defs",
                        "marker",
                        "foreignObject",
                    ],
                    ALLOWED_ATTR: [
                        "viewBox",
                        "width",
                        "height",
                        "x",
                        "y",
                        "x1",
                        "x2",
                        "y1",
                        "y2",
                        "cx",
                        "cy",
                        "r",
                        "rx",
                        "ry",
                        "d",
                        "fill",
                        "stroke",
                        "stroke-width",
                        "stroke-dasharray",
                        "opacity",
                        "transform",
                        "class",
                        "id",
                        "style",
                        "font-family",
                        "font-size",
                        "text-anchor",
                        "dominant-baseline",
                    ],
                    ADD_TAGS: ["foreignObject"],
                    ADD_ATTR: ["xmlns", "xmlns:xlink", "role"],
                });
                setSvgContent(sanitized);
            } catch (err) {
                console.error("Failed to render linkage diagram:", err);
                setError("Failed to render diagram. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        renderDiagram();
    }, [open, issues, relationships]);

    // Inject sanitized SVG into the container div
    useEffect(() => {
        if (svgContent && svgRef.current) {
            svgRef.current.innerHTML = svgContent;
            // Make SVG responsive
            const svg = svgRef.current.querySelector("svg");
            if (svg) {
                svg.style.width = "100%";
                svg.style.height = "auto";
            }
        }
    }, [svgContent]);

    const topLevelCount = issues?.filter((i) => !i.parentIssueId).length ?? 0;
    const hasRelationships = relationships && relationships.length > 0;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-4xl w-full">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Network className="w-4 h-4" />
                        Issue Linkage Diagram
                    </DialogTitle>
                </DialogHeader>

                <div className="mt-2">
                    {!issues || !relationships ? (
                        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                            Loading…
                        </div>
                    ) : topLevelCount === 0 ? (
                        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                            No issues in this board yet.
                        </div>
                    ) : isLoading ? (
                        <div className="flex items-center justify-center h-64 text-sm text-muted-foreground">
                            Rendering diagram…
                        </div>
                    ) : error ? (
                        <div className="flex items-center justify-center h-64 text-sm text-destructive">
                            {error}
                        </div>
                    ) : (
                        <div className="flex flex-col gap-3">
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1.5">
                                    <span className="inline-flex items-center gap-1">
                                        <span className="w-6 inline-block border-t border-gray-500" />
                                        <span>→</span>
                                    </span>
                                    blocks
                                </span>
                                {!hasRelationships && (
                                    <span className="italic">
                                        No blocking relationships defined yet.
                                    </span>
                                )}
                            </div>
                            <div
                                className="overflow-auto rounded-md border bg-muted/20 p-4 min-h-40 max-h-[60vh]"
                                ref={svgRef}
                            />
                        </div>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default BoardLinkageDiagram;
