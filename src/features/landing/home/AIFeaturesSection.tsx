"use client";

import { motion, useInView } from "framer-motion";
import Image from "next/image";
import { useRef, useState } from "react";

interface FeatureCardProps {
	title: string;
	description: string;
	imageSrc: string;
	delay: number;
	isExpanded: boolean;
	onHover: () => void;
	onLeave: () => void;
}

const FeatureCard = ({
	title,
	description,
	imageSrc,
	delay,
	isExpanded,
	onHover,
	onLeave,
}: FeatureCardProps) => {
	const cardRef = useRef<HTMLDivElement>(null);
	const isCardInView = useInView(cardRef, { once: true, margin: "-50px 0px" });

	return (
		<motion.div
			animate={isCardInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
			className={`
        group bg-white rounded-2xl shadow-lg hover:shadow-xl overflow-hidden cursor-pointer
        transition-all duration-500 ease-in-out
        ${isExpanded ? "flex-[3]" : "flex-1"}
        mb-6 lg:mb-0
      `}
			initial={{ opacity: 0, y: 30 }}
			onMouseEnter={onHover}
			onMouseLeave={onLeave}
			ref={cardRef}
			transition={{ duration: 0.6, delay: delay * 0.1 }}
		>
			{/* Mobile Layout - Always show full content */}
			<div className="lg:hidden">
				{/* Image */}
				<div className="relative h-48 bg-gray-50 overflow-hidden rounded-t-2xl">
					<Image
						alt={title}
						className="object-cover object-center w-full h-full"
						fill
						sizes="(max-width: 1024px) 100vw, 25vw"
						src={imageSrc}
					/>
				</div>

				{/* Content */}
				<div className="p-6">
					<div className="flex items-center gap-2 mb-3">
						<span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
							0{delay - 2}
						</span>
					</div>
					<h3 className="text-lg font-semibold text-gray-900 mb-3">{title}</h3>
					<p className="text-gray-600 text-sm leading-relaxed">{description}</p>
				</div>
			</div>

			{/* Desktop Layout - Horizontal Accordion */}
			<div className="hidden lg:block h-[28rem]">
				{/* Image Section - Full container fill */}
				<div className="relative bg-gray-50 overflow-hidden rounded-t-2xl h-64">
					<Image
						alt={title}
						className="object-cover object-center transition-transform duration-500 group-hover:scale-105"
						fill
						sizes="(max-width: 1024px) 100vw, 25vw"
						src={imageSrc}
						style={{
							width: "100%",
							height: "100%",
							objectFit: "cover",
						}}
					/>
				</div>

				{/* Content Section - Fixed height */}
				<div className="p-6 h-48 flex flex-col">
					{/* Number Badge */}
					<div className="flex items-center gap-2 mb-2">
						<span className="text-sm font-medium text-gray-500 bg-gray-100 px-2 py-1 rounded">
							0{delay - 2}
						</span>
					</div>

					{/* Title - Always visible */}
					<h3 className="text-lg font-semibold text-gray-900 mb-3 group-hover:text-primary transition-colors duration-300">
						{title}
					</h3>

					{/* Description - Expands on hover with fixed container */}
					<div className="flex-1 relative overflow-hidden">
						<div
							className={`
              absolute inset-0 transition-all duration-500 ease-in-out
              ${
								isExpanded
									? "translate-y-0 opacity-100"
									: "translate-y-4 opacity-0"
							}
            `}
						>
							<p className="text-gray-600 text-sm leading-relaxed line-clamp-4">
								{description}
							</p>
						</div>
					</div>
				</div>
			</div>
		</motion.div>
	);
};

export const AIFeaturesSection = () => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const isSectionInView = useInView(sectionRef, {
		once: true,
		margin: "-100px 0px",
	});
	const [expandedCard, setExpandedCard] = useState<number | null>(null);

	const features = [
		{
			title: "Reply Suggestions",
			imageSrc: "/ai-reply.svg",
			description:
				"AI analyzes conversation context and generates smart reply options, helping you respond faster and more effectively to messages and comments.",
		},
		{
			title: "Daily Recap",
			imageSrc: "/ai-recap.svg",
			description:
				"Get intelligent summaries of your day's activities, important updates, and key highlights delivered right to your dashboard every morning.",
		},
		{
			title: "Text to Diagram",
			imageSrc: "/ai-diagram.svg",
			description:
				"Transform written descriptions into visual flowcharts, diagrams, and process maps automatically using advanced AI understanding.",
		},
		{
			title: "Notes Formatter",
			imageSrc: "/ai-notes.svg",
			description:
				"Automatically organize, structure, and enhance your meeting notes with intelligent formatting, bullet points, and action item extraction.",
		},
	];

	const handleCardHover = (index: number) => {
		setExpandedCard(index);
	};

	const handleCardLeave = () => {
		setExpandedCard(null);
	};

	return (
		<section
			className="py-16 md:py-24 bg-white relative overflow-hidden"
			ref={sectionRef}
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[20%] -right-[5%] w-[25%] h-[25%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[30%] -left-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				{/* Section Header */}
				<div className="text-center mb-12">
					<motion.div
						animate={
							isSectionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary mb-4"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5 }}
					>
						AI-POWERED FEATURES
					</motion.div>
					<motion.h2
						animate={
							isSectionInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Smart Tools That <span className="text-primary">Amplify</span> Your
						Productivity
					</motion.h2>
				</div>

				{/* Feature Cards - Horizontal Accordion */}
				<div className="flex flex-col lg:flex-row gap-6 lg:gap-4">
					{features.map((feature, index) => (
						<FeatureCard
							delay={index + 3}
							description={feature.description}
							imageSrc={feature.imageSrc}
							isExpanded={expandedCard === index}
							key={feature.title}
							onHover={() => handleCardHover(index)}
							onLeave={handleCardLeave}
							title={feature.title}
						/>
					))}
				</div>
			</div>
		</section>
	);
};
