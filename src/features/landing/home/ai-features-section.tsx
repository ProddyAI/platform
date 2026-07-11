"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
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
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			animate={
				isCardInView
					? { opacity: 1, y: 0 }
					: { opacity: 0, y: shouldReduceMotion ? 0 : 12 }
			}
			className={`
        group rounded-2xl border bg-card shadow-sm hover:shadow-md overflow-hidden
        transition-shadow duration-200 ring-offset-background
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2
        ${isExpanded ? "flex-[3]" : "flex-1"}
        mb-6 lg:mb-0
      `}
			initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
			onBlur={onLeave}
			onFocus={onHover}
			onMouseEnter={onHover}
			onMouseLeave={onLeave}
			ref={cardRef}
			tabIndex={0}
			transition={{ duration: 0.35, delay: delay * 0.06 }}
		>
			{/* Mobile Layout - Always show full content */}
			<div className="lg:hidden">
				{/* Image */}
				<div className="relative h-48 bg-muted overflow-hidden rounded-t-2xl">
					<Image
						alt={title}
						className="object-cover object-center size-full"
						fill
						sizes="(max-width: 1024px) 100vw, 25vw"
						src={imageSrc}
					/>
				</div>

				{/* Content */}
				<div className="p-6">
					<h3 className="text-lg font-semibold text-foreground mb-3">
						{title}
					</h3>
					<p className="text-muted-foreground text-sm leading-relaxed">
						{description}
					</p>
				</div>
			</div>

			{/* Desktop Layout - Horizontal Accordion */}
			<div className="hidden lg:block h-[28rem]">
				{/* Image Section - Full container fill */}
				<div className="relative bg-muted overflow-hidden rounded-t-2xl h-64">
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
					{/* Title - Always visible */}
					<h3 className="text-lg font-semibold text-foreground mb-3 group-hover:text-primary transition-colors duration-300">
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
							<p className="text-muted-foreground text-sm leading-relaxed line-clamp-4">
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
	const shouldReduceMotion = useReducedMotion();

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
			className="py-16 md:py-24 bg-background relative overflow-hidden"
			ref={sectionRef}
		>
			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				{/* Section Header */}
				<div className="text-center mb-12">
					<motion.h2
						animate={
							isSectionInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 12 }
						}
						className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
						transition={{ duration: 0.35, delay: 0.05 }}
					>
						AI Tools That{" "}
						<span className="text-primary">Handle the Busywork</span>
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
