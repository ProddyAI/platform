"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function ContactLayout({ children }: PropsWithChildren) {
	// Set document title for the contact page
	useDocumentTitle("Contact Us");

	return <>{children}</>;
}
