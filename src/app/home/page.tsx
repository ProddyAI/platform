"use client";

import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";
import { AIFeaturesSection } from "@/features/landing/home/AIFeaturesSection";
import { ComparisonSection } from "@/features/landing/home/ComparisonSection";
import { FeatureSection } from "@/features/landing/home/FeatureSection";
import { HeroSection } from "@/features/landing/home/HeroSection";
import { ReplacementSection } from "@/features/landing/home/ReplacementSection";
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
