"use client";

import { motion } from "framer-motion";
import {
	ArrowRight,
	BarChart,
	Calendar,
	CheckSquare,
	MessageSquare,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import {
	type Feature,
	featureGroups,
	features,
} from "@/features/landing/features/features-data";
import { Header } from "@/features/landing/Header";
import { cn } from "@/lib/utils";

const FeaturesPage = () => {
	const heroRef = useRef<HTMLDivElement>(null);
	const searchParams = useSearchParams();
	const [activeTab, setActiveTab] = useState("communication");
	const [_activeFeature, setActiveFeature] = useState<string | null>(null);

	// Handle URL query parameters for tab selection
	useEffect(() => {
		const tabParam = searchParams.get("tab");
		const featureParam = searchParams.get("feature");

		if (
			tabParam &&
			["communication", "taskManagement", "planning", "analytics"].includes(
				tabParam
			)
		) {
			setActiveTab(tabParam);
		}

		if (featureParam) {
			setActiveFeature(featureParam);

			// Scroll to the feature if it exists
			setTimeout(() => {
				const featureElement = document.getElementById(featureParam);
				if (featureElement) {
					featureElement.scrollIntoView({
						behavior: "smooth",
						block: "center",
					});
				}
			}, 500);
		}
	}, [searchParams]);

	// Helper function to get features by group
	const getFeaturesByGroup = (groupId: string) => {
		const groupMap: Record<string, string> = {
			communication: "Communication & Collaboration",
			taskManagement: "Task & Project Management",
			planning: "Planning & Organization",
			analytics: "Analytics & Intelligence",
		};

		const group = featureGroups.find((g) => g.title === groupMap[groupId]);
		return group
			? features.filter((feature) => group.features.includes(feature.id))
			: [];
	};

	// Tab configuration with colors and predefined classes
	const tabConfig = [
		{
			id: "communication",
			icon: <MessageSquare className="size-5 flex-shrink-0" />,
			label: "Communication",
			color: "blue",
			hoverBg: "hover:bg-blue-50",
			hoverText: "hover:text-blue-600",
			hoverRing: "hover:ring-blue-200",
			activeBg: "data-[state=active]:bg-blue-100",
			activeText: "data-[state=active]:text-blue-700",
			activeRing: "data-[state=active]:ring-blue-300",
			indicatorBg: "bg-blue-500",
		},
		{
			id: "taskManagement",
			icon: <CheckSquare className="size-5 flex-shrink-0" />,
			label: "Task Management",
			color: "green",
			hoverBg: "hover:bg-green-50",
			hoverText: "hover:text-green-600",
			hoverRing: "hover:ring-green-200",
			activeBg: "data-[state=active]:bg-green-100",
			activeText: "data-[state=active]:text-green-700",
			activeRing: "data-[state=active]:ring-green-300",
			indicatorBg: "bg-green-500",
		},
		{
			id: "planning",
			icon: <Calendar className="size-5 flex-shrink-0" />,
			label: "Planning",
			color: "purple",
			hoverBg: "hover:bg-purple-50",
			hoverText: "hover:text-purple-600",
			hoverRing: "hover:ring-purple-200",
			activeBg: "data-[state=active]:bg-purple-100",
			activeText: "data-[state=active]:text-purple-700",
			activeRing: "data-[state=active]:ring-purple-300",
			indicatorBg: "bg-purple-500",
		},
		{
			id: "analytics",
			icon: <BarChart className="size-5 flex-shrink-0" />,
			label: "Analytics",
			color: "indigo",
			hoverBg: "hover:bg-indigo-50",
			hoverText: "hover:text-indigo-600",
			hoverRing: "hover:ring-indigo-200",
			activeBg: "data-[state=active]:bg-indigo-100",
			activeText: "data-[state=active]:text-indigo-700",
			activeRing: "data-[state=active]:ring-indigo-300",
			indicatorBg: "bg-indigo-500",
		},
	];

	const fadeInAnimation = {
		initial: { opacity: 0, y: 20 },
		animate: { opacity: 1, y: 0 },
		transition: { duration: 0.5 },
	};

	// Feature image for hero section
	const HeroFeatureImage = ({
		src,
		alt,
		bgColor,
	}: {
		src: string;
		alt: string;
		bgColor: string;
	}) => (
		<div
			className={`${bgColor} rounded-xl h-full overflow-hidden relative shadow-md`}
		>
			<div className="absolute inset-0">
				<Image
					src={src}
					alt={alt}
					fill
					sizes="(max-width: 768px) 100vw, 50vw"
					className="object-cover hover:scale-105 transition-transform duration-700"
					style={{ objectFit: "cover", objectPosition: "center" }}
					priority
				/>
			</div>
		</div>
	);

	// Feature image component
	const FeatureImage = ({
		feature,
		color,
	}: {
		feature: Feature;
		color: string;
	}) => {
		const gradientClass = `bg-gradient-to-r from-${color}-50 to-${color}-100`;
		const accentClass = `bg-${color}-400`;
		// Default image fallback if imageSrc is undefined
		const imageSrc = feature.imageSrc || "/placeholder-feature.png";

		return (
			<div className={`relative h-full ${gradientClass} overflow-hidden`}>
				<div className="absolute inset-0">
					<Image
						src={imageSrc}
						alt={`${feature.name} preview`}
						fill
						sizes="(max-width: 768px) 100vw, 50vw"
						className="object-cover hover:scale-105 transition-transform duration-700 ease-in-out"
						style={{ objectFit: "cover", objectPosition: "center" }}
						priority
					/>
				</div>
				<div
					className={`absolute bottom-0 left-0 w-full h-1 ${accentClass}`}
				></div>
			</div>
		);
	};

	// Feature content component
	const FeatureContent = ({
		feature,
		color,
	}: {
		feature: Feature;
		color: string;
	}) => {
		const arrowColorClass = `text-${color}-500`;

		return (
			<div className="p-7 md:p-10 flex flex-col h-full justify-between">
				<div>
					<div className="flex items-center mb-5 gap-3">
						<div
							className={cn(
								"p-3 rounded-lg text-white shadow-sm",
								feature.color
							)}
						>
							{feature.icon}
						</div>
						<h3 className="text-2xl font-bold text-gray-900">{feature.name}</h3>
					</div>

					<p className="text-gray-700 mb-7 text-base leading-relaxed">
						{feature.detailedDescription.length > 180
							? `${feature.detailedDescription.substring(0, 180)}...`
							: feature.detailedDescription}
					</p>
				</div>

				<div className="mt-auto">
					<h4 className="text-sm font-semibold text-gray-500 uppercase mb-4">
						Key Features
					</h4>
					<ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
						{feature.features.slice(0, 6).map((featureItem, idx) => (
							<li key={idx} className="flex items-start gap-2.5">
								<ArrowRight
									className={`size-4 ${arrowColorClass} mt-1 flex-shrink-0`}
								/>
								<span className="text-sm text-gray-700">{featureItem}</span>
							</li>
						))}
					</ul>
				</div>
			</div>
		);
	};

	// Feature card component
	const FeatureCard = ({
		feature,
		index,
		color,
	}: {
		feature: Feature;
		index: number;
		color: string;
	}) => {
		const hoverBorderClass = `hover:border-${color}-200`;

		return (
			<motion.div
				key={feature.id}
				id={feature.id}
				{...fadeInAnimation}
				transition={{ duration: 0.5, delay: index * 0.1 }}
				className={`bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 hover:shadow-xl ${hoverBorderClass} transition-all duration-300`}
			>
				<div className="grid grid-cols-1 lg:grid-cols-2 h-full">
					{index % 2 === 0 ? (
						// Content on left, image on right for even indexes
						<>
							<div className="h-full">
								<FeatureContent feature={feature} color={color} />
							</div>
							<div className="h-full">
								<FeatureImage feature={feature} color={color} />
							</div>
						</>
					) : (
						// Image on left, content on right for odd indexes
						<>
							<div className="h-full">
								<FeatureImage feature={feature} color={color} />
							</div>
							<div className="h-full">
								<FeatureContent feature={feature} color={color} />
							</div>
						</>
					)}
				</div>
			</motion.div>
		);
	};

	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section - More compact */}
			<section
				className="pt-24 pb-12 md:pt-32 md:pb-16 bg-gradient-to-b from-white via-gray-50/50 to-gray-50 relative overflow-hidden"
				ref={heroRef}
				id="hero"
			>
				<div className="absolute inset-0 overflow-hidden">
					<div className="absolute -top-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
					<div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl" />
				</div>

				<div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8 relative z-10">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center">
						<div className="text-left lg:pr-6">
							<motion.div
								className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-primary/10 text-primary mb-4"
								{...fadeInAnimation}
							>
								MODULAR PRODUCTIVITY SUITE
							</motion.div>

							<motion.h1
								className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-4"
								{...fadeInAnimation}
								transition={{ duration: 0.5, delay: 0.1 }}
							>
								Powerful{" "}
								<span className="text-primary relative">
									Features
									<span className="absolute bottom-2 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full"></span>
								</span>{" "}
								for Every Need
							</motion.h1>

							<motion.p
								className="text-lg md:text-xl text-gray-600 mb-6"
								{...fadeInAnimation}
								transition={{ duration: 0.5, delay: 0.2 }}
							>
								Proddy's modular design built for teams of all sizes - starting
								from college projects to scaling startups.
							</motion.p>

							<motion.div
								className="flex flex-wrap gap-4 mb-6"
								{...fadeInAnimation}
								transition={{ duration: 0.5, delay: 0.3 }}
							>
								<Link href="#features-tabs">
									<Button
										size="lg"
										className="gap-2 rounded-full shadow-md hover:shadow-lg transition-all duration-300 bg-primary hover:bg-primary/90 px-6 py-2 text-base"
									>
										Explore Features <ArrowRight className="size-4" />
									</Button>
								</Link>
								<Link href="/signup">
									<Button
										size="lg"
										variant="outline"
										className="gap-2 rounded-full border-gray-300 hover:border-primary/50 px-6 py-2 text-base"
									>
										Get Started
									</Button>
								</Link>
							</motion.div>
						</div>

						<motion.div
							className="relative h-[300px] md:h-[350px] rounded-2xl overflow-hidden shadow-xl border border-gray-100"
							initial={{ opacity: 0, x: 50 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.7, delay: 0.4 }}
						>
							<div className="absolute inset-0 bg-gradient-to-br from-white/80 via-transparent to-transparent z-10"></div>
							<div className="absolute inset-0">
								<div className="grid grid-cols-2 gap-3 p-4 w-full h-full">
									<div className="flex flex-col gap-3 h-full">
										<div className="h-1/2">
											<HeroFeatureImage
												src="/messages.png"
												alt="Messaging feature"
												bgColor="bg-blue-50"
											/>
										</div>
										<div className="h-1/2">
											<HeroFeatureImage
												src="/tasks.png"
												alt="Tasks feature"
												bgColor="bg-green-50"
											/>
										</div>
									</div>
									<div className="flex flex-col gap-3 h-full">
										<div className="h-1/2">
											<HeroFeatureImage
												src="/calender.png"
												alt="Calendar feature"
												bgColor="bg-purple-50"
											/>
										</div>
										<div className="h-1/2">
											<HeroFeatureImage
												src="/reports.png"
												alt="Reports feature"
												bgColor="bg-indigo-50"
											/>
										</div>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				</div>
			</section>

			{/* Features Tabs Section */}
			<section
				id="features-tabs"
				className="py-16 bg-gradient-to-b from-white to-gray-50"
			>
				<div className="max-w-7xl mx-auto px-4 sm:px-6 md:px-8">
					<Tabs
						value={activeTab}
						onValueChange={setActiveTab}
						className="w-full"
					>
						<div className="mb-16 text-center">
							<h2 className="text-3xl md:text-5xl font-bold text-gray-900 mb-6">
								Explore Our Features
							</h2>
							<p className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto mb-12">
								Discover the powerful tools that make Proddy the ultimate
								productivity platform for modern teams.
							</p>
							<TabsList className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full h-20 max-w-4xl mx-auto bg-white p-2.5 rounded-xl shadow-sm border border-primary/60">
								{tabConfig.map((tab) => (
									<TabsTrigger
										key={tab.id}
										value={tab.id}
										className={cn(
											"relative py-4 px-5 text-base font-medium text-gray-700 rounded-lg ring-1 ring-gray-400",
											tab.hoverBg,
											tab.hoverText,
											tab.hoverRing,
											tab.activeBg,
											tab.activeText,
											tab.activeRing,
											"data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200"
										)}
									>
										<span className="flex items-center justify-center gap-3">
											{tab.icon}
											<span className="hidden sm:inline">{tab.label}</span>
										</span>
										<span
											className={cn(
												"absolute bottom-0 left-1/2 -translate-x-1/2 h-0.5 w-0",
												tab.indicatorBg,
												"data-[state=active]:w-1/2 transition-all duration-300"
											)}
										/>
									</TabsTrigger>
								))}
							</TabsList>
						</div>
						{tabConfig.map((tab) => (
							<TabsContent
								key={tab.id}
								value={tab.id}
								className="mt-8 animate-in fade-in-50 duration-300"
							>
								<div className="space-y-12">
									{getFeaturesByGroup(tab.id).map((feature, index) => (
										<FeatureCard
											key={feature.id}
											feature={feature}
											index={index}
											color={tab.color}
										/>
									))}
								</div>
							</TabsContent>
						))}
					</Tabs>
				</div>
			</section>

			{/* CTA Section */}
			<CTASection />

			<Footer />
		</div>
	);
};

export default FeaturesPage;
