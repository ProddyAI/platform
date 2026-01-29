"use client";

import { useEffect } from "react";
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
	useDocumentTitle("Proddy - Your Team's Second Brain");

	// Force light mode on this page
	useEffect(() => {
		// Remove dark class if present
		document.documentElement.classList.remove("dark");

		// Watch for any attempts to add dark mode back
		const observer = new MutationObserver(() => {
			document.documentElement.classList.remove("dark");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		return () => observer.disconnect();
	}, []);

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
