"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";

import {
	type Feature,
	features,
} from "@/features/landing/features/features-data";
import { cn } from "@/lib/utils";

const FeatureScreenshot = ({ feature }: { feature: Feature }) => {
	const [imageError, setImageError] = useState(false);

	if (imageError) {
		return (
			<div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
				<div className={cn("p-3 rounded-lg text-white w-fit", feature.color)}>
					{feature.icon}
				</div>
				<span className="text-sm font-medium text-muted-foreground">
					{feature.name} module preview
				</span>
			</div>
		);
	}

	return (
		<Image
			alt={`${feature.name} module preview`}
			className="object-cover object-right p-4"
			fill
			onError={() => setImageError(true)}
			priority
			src={feature.imageSrc || "/placeholder-feature.png"}
		/>
	);
};

export const FeatureSection = () => {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-100px 0px" });
	const shouldReduceMotion = useReducedMotion();
	const [activeTab, setActiveTab] = useState("messaging");

	const activeFeature = features.find((s) => s.id === activeTab) || features[0];
	const visibleFeatures = activeFeature.features.slice(0, 5);
	const hasMoreFeatures =
		activeFeature.features.length > visibleFeatures.length;

	return (
		<section
			className="py-16 md:py-24 bg-muted/30 relative overflow-hidden w-full"
			id="modules"
			ref={ref}
		>
			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="text-center mb-10 max-w-7xl mx-auto">
					<motion.h2
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Powerful <span className="text-primary">Tools</span> for Every Need
					</motion.h2>
					<motion.p
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-lg text-muted-foreground max-w-[800px] mx-auto mb-6"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Each tool works on its own or as part of the integrated ecosystem.
					</motion.p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto h-full">
					<motion.div
						animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
						className="lg:col-span-1 bg-card rounded-xl shadow-md p-6 h-full flex flex-col"
						initial={{ opacity: 0, x: shouldReduceMotion ? 0 : -20 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<h3
							className="text-lg font-bold mb-4 text-foreground"
							id="modules-heading"
						>
							Modules
						</h3>
						<div
							aria-labelledby="modules-heading"
							className="space-y-2 flex-grow"
							role="tablist"
						>
							{features.map((feature) => (
								<button
									aria-controls="active-module-panel"
									aria-selected={activeTab === feature.id}
									className={cn(
										"w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
										activeTab === feature.id
											? "bg-primary/5 text-primary"
											: "hover:bg-muted text-muted-foreground"
									)}
									id={`module-tab-${feature.id}`}
									key={feature.id}
									onClick={() => setActiveTab(feature.id)}
									onMouseEnter={() => setActiveTab(feature.id)}
									role="tab"
									type="button"
								>
									<div
										className={cn("p-2 rounded-lg text-white", feature.color)}
									>
										{feature.icon}
									</div>
									<span className="font-medium">{feature.name}</span>
								</button>
							))}
						</div>
					</motion.div>

					<motion.div
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						aria-labelledby={`module-tab-${activeFeature.id}`}
						className="lg:col-span-2 bg-card rounded-xl shadow-md overflow-hidden h-full"
						id="active-module-panel"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						role="tabpanel"
						tabIndex={0}
						transition={{ duration: 0.5, delay: 0.4 }}
					>
						<div className="grid grid-cols-1 md:grid-cols-2 h-full">
							<div className="p-6 flex flex-col justify-between">
								<div>
									<div
										className={cn(
											"p-3 rounded-lg text-white w-fit mb-4",
											activeFeature.color
										)}
									>
										{activeFeature.icon}
									</div>
									<h3 className="text-xl font-bold mb-3 text-foreground">
										{activeFeature.name}
									</h3>
									<p className="text-muted-foreground mb-6">
										{activeFeature.description}
									</p>

									<h4 className="text-sm font-semibold text-muted-foreground uppercase mb-3">
										Key Features
									</h4>
									<ul className="space-y-3 mb-4">
										{visibleFeatures.map((feature) => (
											<li
												className="flex items-start gap-2"
												key={`${activeFeature.id}-${feature}`}
											>
												<ArrowRight className="size-4 text-primary mt-1 flex-shrink-0" />
												<span className="text-foreground">{feature}</span>
											</li>
										))}
									</ul>
									{hasMoreFeatures && (
										<Link
											className="inline-flex items-center gap-1 text-sm font-medium text-primary mb-6 rounded-sm hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
											href={`/features?feature=${activeFeature.id}`}
										>
											See all in Features
											<ArrowRight className="size-3.5" />
										</Link>
									)}
								</div>
							</div>
							<div className="relative bg-muted h-full overflow-hidden">
								<FeatureScreenshot
									feature={activeFeature}
									key={activeFeature.id}
								/>
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
