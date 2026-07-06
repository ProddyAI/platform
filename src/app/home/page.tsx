"use client";

import { CTASection } from "@/features/landing/components/cta-section";
import { Footer } from "@/features/landing/components/footer";
import { Header } from "@/features/landing/components/header";
import { AIFeaturesSection } from "@/features/landing/home/ai-features-section";
import { ComparisonSection } from "@/features/landing/home/comparison-section";
import { FeatureSection } from "@/features/landing/home/feature-section";
import { HeroSection } from "@/features/landing/home/hero-section";
import { ReplacementSection } from "@/features/landing/home/replacement-section";
import { useDocumentTitle } from "@/hooks/use-document-title";

const HomePage = () => {
	useDocumentTitle("Proddy - Your Smart Work Management Suite  ");

	return (
		<div className="min-h-screen flex flex-col">
			<Header />
			<HeroSection />
			<FeatureSection />
			<AIFeaturesSection />
			<ComparisonSection />
			<ReplacementSection />
			<CTASection />
			<Footer />
		</div>
	);
};

export default HomePage;
