"use client";

import mermaid from "mermaid";
import { useEffect, useRef } from "react";

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

export function BoardDependencyDiagram({
	edges,
}: BoardDependencyDiagramProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const renderCountRef = useRef(0);
	const latestRenderIdRef = useRef<string>("");

	useEffect(() => {
		if (!containerRef.current) return;

		if (!mermaidInitialized) {
			mermaid.initialize({
				startOnLoad: false,
				theme: "neutral",
				securityLevel: "loose",
				fontFamily: "inherit",
			});
			mermaidInitialized = true;
		}

		if (edges.length === 0) {
			containerRef.current.innerHTML = "";
			return;
		}

		const seen = new Set<string>();
		const lines: string[] = [];
		for (const e of edges) {
			const fromId = e.blockingIssueId.replace(/[^a-zA-Z0-9]/g, "_");
			const toId = e.blockedIssueId.replace(/[^a-zA-Z0-9]/g, "_");
			const fromTitle = e.blockingTitle.replace(/"/g, "'");
			const toTitle = e.blockedTitle.replace(/"/g, "'");
			
			const key = `${fromId}->${toId}`;
			if (!seen.has(key)) {
				seen.add(key);
				lines.push(`  ${fromId}["${fromTitle}"] --> ${toId}["${toTitle}"]`);
			}
		}

		const diagram = `graph LR\n${lines.join("\n")}`;
		renderCountRef.current += 1;
		const id = `dep-diagram-${renderCountRef.current}-${Math.random()
			.toString(36)
			.slice(2, 10)}`;
		latestRenderIdRef.current = id;

		mermaid
			.render(id, diagram)
			.then(({ svg }) => {
				if (
					containerRef.current &&
					latestRenderIdRef.current === id
				) {
					containerRef.current.innerHTML = svg;
				}
			})
			.catch((err) => {
				console.error("[BoardDependencyDiagram] render error:", err);
				if (
					containerRef.current &&
					latestRenderIdRef.current === id
				) {
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
			ref={containerRef}
			className="w-full overflow-x-auto rounded-md bg-muted/20 p-4 min-h-[80px]"
		/>
	);
}
