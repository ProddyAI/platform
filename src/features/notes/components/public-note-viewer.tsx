"use client";

import { useBlockNoteSync } from "@convex-dev/prosemirror-sync/blocknote";
import "@blocknote/core/fonts/inter.css";
import { BlockNoteView } from "@blocknote/mantine";
import "@blocknote/mantine/style.css";
import { FileText, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface PublicNoteViewerProps {
	noteId: Id<"notes">;
}

/**
 * Renders a shared note's live collaborative document in read-only mode.
 *
 * Reuses the same prosemirror-sync source as the authenticated editor, so the
 * public page always reflects the latest content. Access is gated upstream:
 * the noteId is only handed to this component after the share (and any
 * password) checks pass, and `convex/content/prosemirror.ts` permits reads on
 * notes flagged `isPublic`.
 */
export const PublicNoteViewer = ({ noteId }: PublicNoteViewerProps) => {
	const [theme, setTheme] = useState<"light" | "dark">("light");

	const sync = useBlockNoteSync(api.content.prosemirror, noteId);

	useEffect(() => {
		const updateTheme = () => {
			const isDark = document.documentElement.classList.contains("dark");
			setTheme(isDark ? "dark" : "light");
		};

		updateTheme();

		const observer = new MutationObserver(updateTheme);
		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

	if (sync.isLoading) {
		return (
			<div className="flex min-h-[240px] items-center justify-center">
				<div className="flex flex-col items-center gap-3 text-muted-foreground">
					<Loader2 className="size-6 animate-spin text-primary" />
					<span className="text-sm">Loading note…</span>
				</div>
			</div>
		);
	}

	if (!sync.editor) {
		return (
			<div className="flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted-foreground">
				<FileText className="size-8 opacity-60" />
				<span className="text-sm">This note is empty.</span>
			</div>
		);
	}

	return <BlockNoteView editable={false} editor={sync.editor} theme={theme} />;
};
