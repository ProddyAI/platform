"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function PrivacyLayout({ children }: PropsWithChildren) {
	// Set document title for the privacy page
	useDocumentTitle("Privacy Policy");

	return <>{children}</>;
}
