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
	elements: unknown[];
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
	let elements: unknown[] | undefined;
	let files: unknown;
	try {
		const parserModule = mermaidToExcalidraw as unknown as {
			parseMermaidToExcalidraw?: (
				mermaidCode: string,
				options?: { fontSize?: number }
			) => Promise<{ elements?: unknown[]; files?: unknown }>;
		};
		if (typeof parserModule.parseMermaidToExcalidraw !== "function") {
			throw new Error("Mermaid parser is not available");
		}
		({ elements, files } = await parserModule.parseMermaidToExcalidraw(code, {
			fontSize: 20,
		}));
	} catch (err) {
		const message = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to parse Mermaid diagram: ${message}`);
	}

	const excalidrawModule = excalidraw as unknown as {
		convertToExcalidrawElements?: (
			elements: unknown[] | null,
			options?: { regenerateIds?: boolean }
		) => unknown[];
	};
	if (typeof excalidrawModule.convertToExcalidrawElements !== "function") {
		throw new Error("Excalidraw converter is not available");
	}

	const excalidrawElements = excalidrawModule.convertToExcalidrawElements(
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
