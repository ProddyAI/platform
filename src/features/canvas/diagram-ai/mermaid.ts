"use client";

export function normalizeMermaidCode(input: string): string {
	let text = (input || "").trim();
	if (!text) return "";

	// Strip markdown codefences.
	if (text.startsWith("```")) {
		// Remove first fence line (``` or ```mermaid)
		const firstNewline = text.indexOf("\n");
		if (firstNewline !== -1) {
			text = text.slice(firstNewline + 1);
		}
		// Remove trailing fence
		const lastFence = text.lastIndexOf("```");
		if (lastFence !== -1) {
			text = text.slice(0, lastFence);
		}
		text = text.trim();
	}

	// Some models prepend `mermaid` language tag on its own line.
	text = text.replace(/^mermaid\s*\n/i, "");

	return text.trim();
}

export async function convertMermaidToExcalidrawScene(
	mermaidCode: string
): Promise<{
	elements: any[];
	files: unknown;
}> {
	// This function is used from client-only flows, but the module can still be
	// referenced by Next's server bundle. Guard and only load browser-only deps
	// on the client.
	if (typeof window === "undefined") {
		return { elements: [], files: null };
	}

	const code = normalizeMermaidCode(mermaidCode);
	if (!code) return { elements: [], files: null };

	// This package is also used by Excalidraw internally (Mermaid dialog).
	const [excalidraw, mermaidToExcalidraw] = await Promise.all([
		import("@excalidraw/excalidraw"),
		import("@excalidraw/mermaid-to-excalidraw"),
	]);

	// parseMermaidToExcalidraw returns element skeletons + optional files.
	const { elements, files } = await (
		mermaidToExcalidraw as any
	).parseMermaidToExcalidraw(code, {
		fontSize: 20,
	});

	const excalidrawElements = (excalidraw as any).convertToExcalidrawElements(
		elements ?? null,
		{
			regenerateIds: true,
		}
	);

	return {
		elements: excalidrawElements,
		files,
	};
}
