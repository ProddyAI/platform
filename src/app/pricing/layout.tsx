"use client";

import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function PricingLayout({ children }: PropsWithChildren) {
	// Set document title for the pricing page
	useDocumentTitle("Pricing");

	return <>{children}</>;
}
