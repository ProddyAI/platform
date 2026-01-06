"use client";

import { motion, useInView } from "framer-motion";
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
}

// Arrow component with animated dots
const AnimatedArrow: React.FC<AnimatedArrowProps> = ({
	startX,
	startY,
	endX,
	endY,
	delay,
}) => {
	const midX = (startX + endX) / 2;
	const curveOffsetY = -30;
	const path = `M${startX},${startY} Q${midX},${startY + curveOffsetY} ${endX},${endY}`;

	return (
		<svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-20">
			<path
				d={path}
				fill="none"
				stroke="rgba(209, 213, 219, 0.5)"
				strokeWidth={1.5}
				strokeLinecap="round"
			/>
			{[0, 1, 2].map((i) => (
				<g key={i}>
					<circle
						r={3}
						fill="var(--primary)"
						filter="drop-shadow(0 0 2px rgba(99, 102, 241, 0.6))"
					>
						<animateMotion
							path={path}
							dur="3s"
							begin={`${delay + i * 0.5}s`}
							repeatCount="indefinite"
							rotate="auto"
						/>
					</circle>
				</g>
			))}
			<polygon
				points={`${endX - 5},${endY - 5} ${endX},${endY} ${endX - 5},${endY + 5}`}
				fill="rgba(209, 213, 219, 0.7)"
				transform={`rotate(${Math.atan2(endY - (startY + curveOffsetY), endX - midX) * (180 / Math.PI)}, ${endX}, ${endY})`}
				rx="1"
				ry="1"
			/>
		</svg>
	);
};

export const ReplacementSection = () => {
	const sectionRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(sectionRef, { once: true, margin: "-100px 0px" });

	const containerRef = useRef<HTMLDivElement>(null);
	const toolRefs = useRef<(HTMLDivElement | null)[]>([]);
	const [dimensions, setDimensions] = React.useState({ width: 0, height: 0 });
	const [toolPositions, setToolPositions] = React.useState<
		{ x: number; y: number }[]
	>([]);

	React.useEffect(() => {
		const updateDimensions = () => {
			if (containerRef.current) {
				setDimensions({
					width: containerRef.current.offsetWidth,
					height: containerRef.current.offsetHeight,
				});
			}
		};
		updateDimensions();
		window.addEventListener("resize", updateDimensions);
		return () => window.removeEventListener("resize", updateDimensions);
	}, []);

	React.useEffect(() => {
		if (!containerRef.current) return;
		const containerRect = containerRef.current.getBoundingClientRect();
		const positions = toolRefs.current.map((ref) => {
			if (!ref) return { x: 0, y: 0 };
			const rect = ref.getBoundingClientRect();
			return {
				x: rect.left - containerRect.left + rect.width / 2,
				y: rect.top - containerRect.top + rect.height / 2,
			};
		});
		setToolPositions(positions);
	}, []);

	return (
		<section
			ref={sectionRef}
			className="py-16 md:py-24 bg-gray-50 relative overflow-hidden w-full"
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[10%] -right-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[20%] -left-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				<motion.h2
					initial={{ opacity: 0, y: 20 }}
					animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
					transition={{ duration: 0.5, delay: 0.1 }}
					className="text-3xl md:text-4xl font-bold text-center mb-6 text-gray-900"
				>
					Replace Multiple Tools with{" "}
					<span className="text-primary">Proddy</span>
				</motion.h2>

				<motion.div
					ref={containerRef}
					initial={{ opacity: 0 }}
					animate={isInView ? { opacity: 1 } : { opacity: 0 }}
					transition={{ duration: 0.5, delay: 0.3 }}
					className="relative h-[400px] md:h-[500px] w-full"
				>
					{/* Left: Tools - Increased space-y to space-y-8 for more vertical separation */}
					<div className="z-30 absolute left-0 top-1/2 transform -translate-y-1/2 w-1/3 flex flex-col items-center space-y-8">
						{tools.map((tool, index) => (
							<motion.div
								key={tool.name}
								ref={(el) => {
									toolRefs.current[index] = el;
								}}
								className="flex items-center p-3 rounded-lg shadow-md bg-white border border-gray-100 hover:border-primary/20"
								initial={{ x: -50, opacity: 0 }}
								animate={
									isInView
										? {
												x: 0,
												opacity: 1,
												scale: 1,
											}
										: { x: -50, opacity: 0 }
								}
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
									<tool.icon size={24} color={tool.color} className="mr-2" />
								</motion.div>
								<span className="font-medium text-gray-800">{tool.name}</span>
							</motion.div>
						))}
					</div>

					{/* Arrows */}
					{dimensions.width > 0 &&
						toolPositions.length === tools.length &&
						tools.map((tool, index) => {
							const { x, y } = toolPositions[index];
							// Adjusted endX to align with the new Proddy center
							const endX = dimensions.width * 0.85; // Adjusted from 0.70 to 0.85
							const endY = dimensions.height / 2;
							return (
								<AnimatedArrow
									key={`arrow-${tool.name}`}
									startX={x}
									startY={y}
									endX={endX}
									endY={endY}
									delay={index * 0.2}
								/>
							);
						})}

					{/* Right: Proddy - Adjusted to center horizontally at the new arrow convergence point */}
					<motion.div
						className="absolute left-[70%] top-[40%] -translate-x-1/2 -translate-y-1/2 w-1/3 flex justify-center z-30" // Adjusted left-[70%] to left-[85%]
						initial={{ x: 50, opacity: 0 }}
						animate={isInView ? { x: 0, opacity: 1 } : { x: 50, opacity: 0 }}
						transition={{ duration: 0.7, delay: 0.5 }}
					>
						<div className="bg-primary text-white p-6 md:p-8 rounded-2xl shadow-lg flex flex-col items-center justify-center">
							<div className="w-16 h-16 md:w-20 md:h-20 flex items-center justify-center">
								<div className="relative w-full h-full">
									<Image
										src="/logo-white.png"
										alt="Proddy Logo"
										fill
										className="object-contain"
										priority
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
