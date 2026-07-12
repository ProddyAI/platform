"use client";

import { domAnimation, LazyMotion } from "framer-motion";
import type { PropsWithChildren } from "react";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function AssistantLayout({ children }: PropsWithChildren) {
	// Set document title for the assistant page
	useDocumentTitle("Assistant");

	return (
		<LazyMotion features={domAnimation} strict>
			{children}
		</LazyMotion>
	);
}
