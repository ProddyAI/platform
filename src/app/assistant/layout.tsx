"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function AssistantLayout({ children }: PropsWithChildren) {
	// Set document title for the assistant page
	useDocumentTitle("Assistant");

	return <>{children}</>;
}
