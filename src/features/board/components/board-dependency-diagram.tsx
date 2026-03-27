"use client";

import DOMPurify from "dompurify";
import mermaid from "mermaid";
import { useEffect, useRef } from "react";
import { createMermaidDependencyDiagram } from "@/features/board/lib/dependency-diagram";

export interface BlockingEdge {
	blockingIssueId: string;
	blockedIssueId: string;
	blockingTitle: string;
	blockedTitle: string;
}

interface BoardDependencyDiagramProps {
	edges: BlockingEdge[];
}

let mermaidInitialized = false;

export function BoardDependencyDiagram({ edges }: BoardDependencyDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderCountRef = useRef(0);
	const latestRenderIdRef = useRef<string>("");

	useEffect(() => {
		if (!containerRef.current) return;

		if (!mermaidInitialized) {
			mermaid.initialize({
				startOnLoad: false,
				theme: "neutral",
				securityLevel: "strict",
				fontFamily: "inherit",
				flowchart: {
					htmlLabels: false,
					useMaxWidth: true,
				},
			});
			mermaidInitialized = true;
		}

		if (edges.length === 0) {
			containerRef.current.innerHTML = "";
			return;
		}

		const diagram = createMermaidDependencyDiagram(edges);
		renderCountRef.current += 1;
		const id = `dep-diagram-${renderCountRef.current}-${Math.random()
			.toString(36)
			.slice(2, 10)}`;
		latestRenderIdRef.current = id;

		mermaid
			.render(id, diagram)
			.then(({ svg }) => {
				if (containerRef.current && latestRenderIdRef.current === id) {
					containerRef.current.innerHTML = DOMPurify.sanitize(svg, {
						USE_PROFILES: { svg: true, svgFilters: true },
					});
				}
			})
			.catch((err) => {
				console.error("[BoardDependencyDiagram] render error:", err);
				if (containerRef.current && latestRenderIdRef.current === id) {
					containerRef.current.innerHTML =
						'<p class="text-sm text-destructive">Failed to render diagram.</p>';
				}
			});
	}, [edges]);

	if (edges.length === 0) {
		return (
			<p className="text-sm text-muted-foreground text-center py-8">
				No blocking relationships exist yet.
			</p>
		);
	}

	return (
		<div
			className="w-full overflow-x-auto rounded-md bg-muted/20 p-4 min-h-[80px]"
			ref={containerRef}
		/>
	);
}
