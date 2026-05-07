"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function FeaturesLayout({ children }: PropsWithChildren) {
	// Set document title for the features page
	useDocumentTitle("Features");

	return <>{children}</>;
}
