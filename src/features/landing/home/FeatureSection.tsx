"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";

import { features } from "@/features/landing/features/features-data";
import { cn } from "@/lib/utils";

export const FeatureSection = () => {
	const ref = useRef<HTMLDivElement>(null);
	const isInView = useInView(ref, { once: true, margin: "-100px 0px" });
	const [activeTab, setActiveTab] = useState("messaging");

	const activeFeature = features.find((s) => s.id === activeTab) || features[0];

	return (
		<section
			className="py-16 md:py-24 bg-gray-50 relative overflow-hidden w-full"
			id="modules"
			ref={ref}
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[20%] -left-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="text-center mb-10 max-w-7xl mx-auto">
					<motion.h2
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Powerful <span className="text-primary">Tools</span> for Every Need
					</motion.h2>
					<motion.p
						animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-lg text-gray-600 max-w-[800px] mx-auto mb-6"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Each tool works perfectly on its own or as part of the integrated
						ecosystem.
					</motion.p>
				</div>

				<div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-7xl mx-auto h-full">
					<motion.div
						animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }}
						className="lg:col-span-1 bg-white rounded-xl shadow-md p-6 h-full flex flex-col"
						initial={{ opacity: 0, x: -20 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<h3 className="text-lg font-bold mb-4 text-gray-900">Modules</h3>
						<div className="space-y-2 flex-grow">
							{features.map((feature) => (
								<button
									className={cn(
										"w-full flex items-center gap-3 p-3 rounded-lg text-left transition-all duration-200",
										activeTab === feature.id
											? "bg-primary/5 text-primary"
											: "hover:bg-gray-50 text-gray-700"
									)}
									key={feature.id}
									onMouseEnter={() => setActiveTab(feature.id)}
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
						className="lg:col-span-2 bg-white rounded-xl shadow-md overflow-hidden h-full"
						initial={{ opacity: 0, y: 20 }}
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
									<h3 className="text-xl font-bold mb-3 text-gray-900">
										{activeFeature.name}
									</h3>
									<p className="text-gray-600 mb-6">
										{activeFeature.description}
									</p>

									<h4 className="text-sm font-semibold text-gray-500 uppercase mb-3">
										Key Features
									</h4>
									<ul className="space-y-3 mb-6">
										{activeFeature.features.map((feature, index) => (
											<li
												className="flex items-start gap-2"
												key={`${activeFeature.id}-feature-${index}`}
											>
												<ArrowRight className="size-4 text-primary mt-1 flex-shrink-0" />
												<span className="text-gray-700">{feature}</span>
											</li>
										))}
									</ul>
								</div>
							</div>
							<div className="relative bg-gray-100 h-full overflow-hidden">
								<Image
									alt={`${activeFeature.name} module preview`}
									className="object-cover object-right p-4"
									fill
									priority
									src={activeFeature.imageSrc || "/placeholder-feature.png"}
								/>
							</div>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
