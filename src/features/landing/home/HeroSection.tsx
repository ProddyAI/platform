"use client";

import { motion } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useEffect, useState } from "react";

export const HeroSection = () => {
	const [isVisible, setIsVisible] = useState(false);

	useEffect(() => {
		setIsVisible(true);
	}, []);

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.2,
				delayChildren: 0.3,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: 20 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.5,
				ease: [0.25, 0.1, 0.25, 1.0] as const,
			},
		},
	};

	const imageVariants = {
		hidden: { opacity: 0, scale: 0.95 },
		visible: {
			opacity: 1,
			scale: 1,
			transition: {
				duration: 0.7,
				ease: [0.25, 0.1, 0.25, 1.0] as const,
				delay: 0.6,
			},
		},
	};

	return (
		<section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-gradient-to-b from-white via-gray-50/50 to-gray-50">
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute -top-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				<motion.div
					animate={isVisible ? "visible" : "hidden"}
					className="flex flex-col items-center text-center"
					initial="hidden"
					variants={containerVariants}
				>
					<motion.div className="mb-4" variants={itemVariants}>
						<span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary">
							AI-Powered Productivity Suite
						</span>
					</motion.div>

					<motion.h1
						className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4 max-w-4xl"
						variants={itemVariants}
					>
						Your Team's Smart <br></br>
						<span className="text-primary relative">
							Work Management
							<span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full" />
						</span>{" "}
						Suite
					</motion.h1>

					<motion.p
						className="text-lg md:text-xl text-gray-600 mb-6 max-w-[800px]"
						variants={itemVariants}
					>
						Proddy unifies canvas, meetings, messaging, notes so work moves from
						discussion to execution without friction.
					</motion.p>

					<motion.div
						className="relative w-full max-w-[1600px]"
						variants={imageVariants}
					>
						<div className="rounded-2xl overflow-hidden shadow-xl bg-white p-1">
							<div className="relative rounded-xl overflow-hidden">
								<div
									style={{
										position: "relative",
										boxSizing: "content-box",
										maxHeight: "95vh",
										width: "100%",
										aspectRatio: "1.761467889908257",
										padding: "10px 0 10px 0",
									}}
								>
									<iframe
										allow="fullscreen https://app.supademo.com clipboard-write"
										loading="lazy"
										sandbox="allow-scripts allow-same-origin allow-presentation allow-popups"
										src="https://app.supademo.com/embed/cmb4xp1ch2omwppkpndluqnku?embed_v=2"
										style={{
											position: "absolute",
											top: 0,
											left: 0,
											width: "100%",
											height: "100%",
											border: "none",
											borderRadius: "12px",
										}}
										title="Proddy Interactive Demo"
									/>
								</div>
							</div>
						</div>
					</motion.div>

					<motion.div
						animate={{ opacity: 1, y: 0 }}
						className="mt-12 flex justify-center"
						initial={{ opacity: 0, y: 20 }}
						transition={{ delay: 1.5, duration: 0.5 }}
					>
						<button
							className="flex flex-col items-center text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
							onClick={() => {
								const element = document.getElementById("modules");
								if (element) {
									element.scrollIntoView({
										behavior: "smooth",
										block: "start",
									});
								}
							}}
						>
							<span className="text-sm font-medium mb-2">Discover More</span>
							<ChevronDown className="size-5 animate-bounce" />
						</button>
					</motion.div>
				</motion.div>
			</div>
		</section>
	);
};
