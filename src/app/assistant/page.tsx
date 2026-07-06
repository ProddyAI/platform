import type { Metadata } from "next";
import { FAQSection } from "@/features/landing/assistant/faq-section";
import { FeaturesSection } from "@/features/landing/assistant/features-section";
import { HeroSection } from "@/features/landing/assistant/hero-section";
import { UseCasesSection } from "@/features/landing/assistant/use-cases-section";
import { CTASection } from "@/features/landing/components/cta-section";
import { Footer } from "@/features/landing/components/footer";
import { Header } from "@/features/landing/components/header";

export const metadata: Metadata = {
	title: "Assistant | Proddy",
	description:
		"Meet Proddy AI, your team's intelligent workspace assistant. Get instant answers, contextual search, and smart insights from your workspace data.",
	keywords: [
		"AI assistant",
		"workspace AI",
		"team productivity",
		"intelligent search",
		"Proddy AI",
	],
	openGraph: {
		title: "Proddy AI - Your Intelligent Workspace Assistant",
		description:
			"Meet Proddy AI, your team's intelligent workspace assistant. Get instant answers, contextual search, and smart insights from your workspace data.",
		type: "website",
	},
};

export default function AssistantPage() {
	return (
		<div className="min-h-screen flex flex-col">
			<Header />
			<HeroSection />
			<FeaturesSection />
			<UseCasesSection />
			<FAQSection />
			<CTASection />
			<Footer />
		</div>
	);
}
