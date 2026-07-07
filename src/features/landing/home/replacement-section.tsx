"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import Image from "next/image";
import React, { useRef } from "react";
import {
	SiConfluence,
	SiMiro,
	SiNotion,
	SiSlack,
	SiTodoist,
} from "react-icons/si";

// Tool data with icons and names
const tools = [
	{ name: "Confluence", icon: SiConfluence, color: "#0052CC" },
	{ name: "Notion", icon: SiNotion, color: "#000000" },
	{ name: "Slack", icon: SiSlack, color: "#4A154B" },
	{ name: "Todoist", icon: SiTodoist, color: "#E44332" },
	{ name: "Miro Board", icon: SiMiro, color: "#FFD02F" },
];

// Define types for the AnimatedArrow props
interface AnimatedArrowProps {
	startX: number;
	startY: number;
	endX: number;
	endY: number;
	delay: number;
	reduceMotion: boolean;
}

// Arrow component with animated dots
const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
	startX,
	startY,
	endX,
	endY,
	delay,
	reduceMotion,
}) => {
	const midX = (startX + endX) / 2;
	const curveOffsetY = -30;
	const path = `M${startX},${startY} Q${midX},${startY + curveOffsetY} ${endX},${endY}`;

	return (
		<svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
			<title>Connection path</title>
			<path
				d={path}
				fill="none"
				strokeLinecap="round"
				strokeWidth={1.5}
				style={{ stroke: "hsl(var(--border))" }}
			/>
			{!reduceMotion &&
				[0, 1, 2].map((i) => (
					<g key={i}>
						<circle
							r={3}
							style={{
								fill: "hsl(var(--primary))",
								filter: "drop-shadow(0 0 2px hsl(var(--primary) / 0.6))",
							}}
						>
							<animateMotion
								begin={`${delay + i * 0.5}s`}
								dur="3s"
								path={path}
								repeatCount="indefinite"
								rotate="auto"
							/>
						</circle>
					</g>
				))}
			<polygon
				points={`${endX - 5},${endY - 5} ${endX},${endY} ${endX - 5},${endY + 5}`}
				rx="1"
				ry="1"
				style={{ fill: "hsl(var(--muted-foreground) / 0.6)" }}
				transform={`rotate(${Math.atan2(endY - (startY + curveOffsetY), endX - midX) * (180 / Math.PI)}, ${endX}, ${endY})`}
			/>
		</svg>
	);
};

export const ReplacementSection = () => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(sectionRef, { once: true, margin: "-100px 0px" });
	const shouldReduceMotion = useReducedMotion();

	const containerRef = useRef<HTMLDivElement>(null);
	const toolRefs = useRef<(HTMLDivElement | null)[]>([]);
	const logoRef = useRef<HTMLDivElement>(null);
	const [containerWidth, setContainerWidth] = React.useState(0);
	const [toolPositions, setToolPositions] = React.useState<
		{ x: number; y: number }[]
	>([]);
	const [logoPosition, setLogoPosition] = React.useState<{
		x: number;
		y: number;
	} | null>(null);

	// Measures tool/logo card centers relative to the container so arrows can
	// target real DOM positions instead of guessed percentages. Re-run on
	// resize and once the entrance animation settles (cards animate in from an
	// offset, so a measurement taken mid-animation would be wrong).
	const measurePositions = React.useCallback(() => {
		if (!containerRef.current) return;
		const containerRect = containerRef.current.getBoundingClientRect();
		setContainerWidth(containerRect.width);
		const positions = toolRefs.current.map((ref) => {
			if (!ref) return { x: 0, y: 0 };
			const rect = ref.getBoundingClientRect();
			return {
				x: rect.left - containerRect.left + rect.width / 2,
				y: rect.top - containerRect.top + rect.height / 2,
			};
		});
		setToolPositions(positions);
		if (logoRef.current) {
			const logoRect = logoRef.current.getBoundingClientRect();
			setLogoPosition({
				x: logoRect.left - containerRect.left + logoRect.width / 2,
				y: logoRect.top - containerRect.top + logoRect.height / 2,
			});
		}
	}, []);

	React.useEffect(() => {
		measurePositions();
		const container = containerRef.current;
		if (!container) return;
		const observer = new ResizeObserver(() => measurePositions());
		observer.observe(container);
		return () => observer.disconnect();
	}, [measurePositions]);

	return (
		<section
			className="py-16 md:py-24 bg-muted/30 relative overflow-hidden w-full"
			ref={sectionRef}
		>
			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				<motion.h2
					animate={
						isInView
							? { opacity: 1, y: 0 }
							: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
					}
					className="text-3xl md:text-4xl font-bold text-center mb-6 text-foreground"
					initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
					transition={{ duration: 0.5, delay: 0.1 }}
				>
					Replace Multiple Tools with{" "}
					<span className="text-primary">Proddy</span>
				</motion.h2>

				<motion.div
					animate={isInView ? { opacity: 1 } : { opacity: 0 }}
					className="relative h-[400px] md:h-[500px] w-full"
					initial={{ opacity: 0 }}
					ref={containerRef}
					transition={{ duration: 0.5, delay: 0.3 }}
				>
					{/* Left: Tools - Increased space-y to space-y-8 for more vertical separation */}
					<div className="z-30 absolute left-0 top-1/2 transform -translate-y-1/2 w-1/3 flex flex-col items-center space-y-8">
						{tools.map((tool, index) => (
							<motion.div
								animate={
									isInView
										? {
												x: 0,
												opacity: 1,
												scale: 1,
											}
										: { x: shouldReduceMotion ? 0 : -50, opacity: 0 }
								}
								className="flex items-center p-3 rounded-lg shadow-md bg-card border border-border hover:border-primary/20"
								initial={{ x: shouldReduceMotion ? 0 : -50, opacity: 0 }}
								key={tool.name}
								onAnimationComplete={measurePositions}
								ref={(el) => {
									toolRefs.current[index] = el;
								}}
								transition={{
									duration: 0.5,
									delay: 0.4 + index * 0.1,
								}}
								whileHover={{
									scale: 1.05,
									boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)",
								}}
							>
								<motion.div>
									<tool.icon className="mr-2" color={tool.color} size={24} />
								</motion.div>
								<span className="font-medium text-card-foreground">
									{tool.name}
								</span>
							</motion.div>
						))}
					</div>

					{/* Arrows */}
					{containerWidth > 0 &&
						logoPosition &&
						toolPositions.length === tools.length &&
						tools.map((tool, index) => {
							const { x, y } = toolPositions[index];
							return (
								<AnimatedArrow
									delay={index * 0.2}
									endX={logoPosition.x}
									endY={logoPosition.y}
									key={`arrow-${tool.name}`}
									reduceMotion={Boolean(shouldReduceMotion)}
									startX={x}
									startY={y}
								/>
							);
						})}

					{/* Right: Proddy */}
					<motion.div
						animate={
							isInView
								? { x: 0, opacity: 1 }
								: { x: shouldReduceMotion ? 0 : 50, opacity: 0 }
						}
						className="absolute left-[70%] top-[40%] -translate-x-1/2 -translate-y-1/2 w-1/3 flex justify-center z-30"
						initial={{ x: shouldReduceMotion ? 0 : 50, opacity: 0 }}
						onAnimationComplete={measurePositions}
						transition={{ duration: 0.7, delay: 0.5 }}
					>
						<div
							className="bg-primary text-primary-foreground p-6 md:p-8 rounded-2xl shadow-lg flex flex-col items-center justify-center"
							ref={logoRef}
						>
							<div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
								<div className="relative w-full h-full">
									<Image
										alt="Proddy Logo"
										className="object-contain"
										fill
										priority
										src="/logo-white.png"
									/>
								</div>
							</div>
						</div>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
};
