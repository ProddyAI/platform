"use client";

import { m, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

export const HeroSection = () => {
	const [isVisible, setIsVisible] = useState(false);
	const shouldReduceMotion = useReducedMotion();

	useEffect(() => {
		setIsVisible(true);
	}, []);

	const containerVariants = {
		hidden: { opacity: 0 },
		visible: {
			opacity: 1,
			transition: {
				staggerChildren: 0.12,
				delayChildren: 0.15,
			},
		},
	};

	const itemVariants = {
		hidden: { opacity: 0, y: shouldReduceMotion ? 0 : 12 },
		visible: {
			opacity: 1,
			y: 0,
			transition: {
				duration: 0.35,
				ease: [0.25, 0.1, 0.25, 1.0] as const,
			},
		},
	};

	const imageVariants = {
		hidden: { opacity: 0, scale: shouldReduceMotion ? 1 : 0.98 },
		visible: {
			opacity: 1,
			scale: 1,
			transition: {
				duration: 0.4,
				ease: [0.25, 0.1, 0.25, 1.0] as const,
				delay: 0.3,
			},
		},
	};

	return (
		<section className="relative w-full pt-24 pb-16 md:pt-32 md:pb-24 overflow-hidden bg-muted/30">
			{/* Ambient brand wash — a soft purple aurora that grounds the hero in
			    primary without tinting the readable content above it. */}
			<div aria-hidden className="pointer-events-none absolute inset-0 z-0">
				<div className="absolute left-1/2 -top-24 h-[560px] w-[900px] max-w-[95vw] -translate-x-1/2 rounded-full bg-primary/25 blur-[130px]" />
				<div className="absolute left-[12%] top-1/3 h-[380px] w-[380px] rounded-full bg-secondary/10 blur-[120px]" />
				<div className="absolute right-[10%] top-1/4 h-[320px] w-[320px] rounded-full bg-primary/15 blur-[120px]" />
			</div>
			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-7xl">
				<m.div
					animate={isVisible ? "visible" : "hidden"}
					className="flex flex-col items-center text-center"
					initial="hidden"
					variants={containerVariants}
				>
					<m.h1
						className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4 max-w-4xl"
						variants={itemVariants}
					>
						Your Team&apos;s Smart <br />
						<span className="text-primary">Work Management</span> Suite
					</m.h1>

					<m.p
						className="text-lg md:text-xl text-muted-foreground mb-6 max-w-[800px]"
						variants={itemVariants}
					>
						Proddy unifies messaging, tasks, boards, canvas, notes, and meetings
						so work moves from discussion to execution without friction.
					</m.p>

					<m.div
						className="flex flex-col sm:flex-row gap-4 justify-center mb-10"
						variants={itemVariants}
					>
						<Button
							asChild
							className="gap-2 rounded-full text-primary-foreground bg-primary hover:bg-primary/90 px-8 py-3 shadow-md text-base"
							size="lg"
						>
							<Link href="/auth/signup">
								Get Started Free <ArrowRight className="size-4" />
							</Link>
						</Button>
						<Button
							asChild
							className="rounded-full px-8 py-3 text-base"
							size="lg"
							variant="outline"
						>
							<Link href="#modules">See How It Works</Link>
						</Button>
					</m.div>

					<m.div
						className="relative w-full max-w-[1600px]"
						variants={imageVariants}
					>
						<div className="rounded-2xl overflow-hidden border bg-card shadow-lg p-1">
							<div className="relative rounded-xl overflow-hidden">
								<div
									style={{
										position: "relative",
										boxSizing: "content-box",
										maxHeight: "95vh",
										width: "100%",
										aspectRatio: "1.761467889908257",
									}}
								>
									<iframe
										allow="fullscreen https://app.supademo.com clipboard-write"
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
					</m.div>
				</m.div>
			</div>
		</section>
	);
};
