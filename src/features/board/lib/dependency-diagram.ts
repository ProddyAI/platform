export interface DependencyDiagramEdge {
	blockingIssueId: string;
	blockedIssueId: string;
	blockingTitle: string;
	blockedTitle: string;
}

const MERMAID_META_REGEX = /["'`<>[\]{}()|\\]/g;
const WHITESPACE_REGEX = /\s+/g;

export function sanitizeMermaidLabel(value: string, maxLength = 120): string {
	const normalized = Array.from(value.normalize("NFKC"))
		.map((char) => {
			const codePoint = char.codePointAt(0);
			return codePoint !== undefined && codePoint >= 32 && codePoint !== 127
				? char
				: " ";
		})
		.join("")
		.replace(MERMAID_META_REGEX, " ")
		.replace(WHITESPACE_REGEX, " ")
		.trim();

	if (!normalized) {
		return "Untitled";
	}

	if (normalized.length <= maxLength) {
		return normalized;
	}

	return `${normalized.slice(0, maxLength - 3).trimEnd()}...`;
}

export function createMermaidDependencyDiagram(
	edges: readonly DependencyDiagramEdge[]
): string {
	if (edges.length === 0) {
		return "";
	}

	const nodeIdByIssueId = new Map<string, string>();
	const nodeLines: string[] = [];
	const edgeLines: string[] = [];
	const seenEdges = new Set<string>();

	const ensureNode = (issueId: string, title: string) => {
		const existingNodeId = nodeIdByIssueId.get(issueId);
		if (existingNodeId) {
			return existingNodeId;
		}

		const nodeId = `n${nodeIdByIssueId.size}`;
		nodeIdByIssueId.set(issueId, nodeId);
		nodeLines.push(`  ${nodeId}["${sanitizeMermaidLabel(title)}"]`);
		return nodeId;
	};

	for (const edge of edges) {
		const fromNodeId = ensureNode(
			String(edge.blockingIssueId),
			edge.blockingTitle
		);
		const toNodeId = ensureNode(String(edge.blockedIssueId), edge.blockedTitle);
		const edgeKey = `${fromNodeId}->${toNodeId}`;

		if (seenEdges.has(edgeKey)) {
			continue;
		}

		seenEdges.add(edgeKey);
		edgeLines.push(`  ${fromNodeId} --> ${toNodeId}`);
	}

	return ["flowchart LR", ...nodeLines, ...edgeLines].join("\n");
}
