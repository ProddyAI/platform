"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

export const CTASection = () => {
	const ctaRef = useRef<HTMLDivElement>(null);
	const isCtaInView = useInView(ctaRef, { once: true, margin: "-100px 0px" });

	return (
		<section ref={ctaRef} className="py-20 bg-white relative overflow-hidden">
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[20%] -right-[5%] w-[25%] h-[25%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[30%] -left-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-4xl">
				<motion.div
					className="text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
					transition={{ duration: 0.5 }}
				>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="mb-4"
					>
						<span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary">
							<Sparkles className="mr-1 h-3.5 w-3.5" />
							Free Public Beta
						</span>
					</motion.div>

					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="text-3xl md:text-4xl font-bold tracking-tight text-gray-900 mb-4"
					>
						Start Building with{" "}
						<span className="text-primary relative">
							Proddy Today
							<span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full"></span>
						</span>
					</motion.h2>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.3 }}
						className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto"
					>
						Join teams already using Proddy to streamline their workflow and
						boost productivity. Get started for free during our public beta and
						experience the full platform at no cost.
					</motion.p>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.4 }}
						className="flex flex-col sm:flex-row gap-4 justify-center"
					>
						<Link href="/signup">
							<Button
								size="lg"
								className="gap-2 rounded-full text-white bg-primary hover:bg-primary/90 px-8 py-3 shadow-md text-base"
							>
								Get Started Free <ArrowRight className="size-4" />
							</Button>
						</Link>
						<Link href="/pricing">
							<Button
								size="lg"
								variant="outline"
								className="gap-2 rounded-full bg-white border-slate-300 text-slate-700 hover:bg-slate-100 px-8 py-3 text-base"
							>
								Learn More
							</Button>
						</Link>
					</motion.div>

					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.5 }}
						className="text-sm text-gray-500 mt-6"
					>
						No credit card required • Free during public beta • Full platform
						access
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
};
