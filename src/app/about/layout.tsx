"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function AboutLayout({ children }: PropsWithChildren) {
	// Set document title for the about page
	useDocumentTitle("About Us");

	return <>{children}</>;
}
