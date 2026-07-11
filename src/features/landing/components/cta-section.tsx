"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";

import { Button } from "@/components/ui/button";

export const CTASection = () => {
	const ctaRef = useRef<HTMLDivElement>(null);
	const isCtaInView = useInView(ctaRef, { once: true, margin: "-100px 0px" });
	const shouldReduceMotion = useReducedMotion();
	const hiddenY = shouldReduceMotion ? 0 : 12;

	return (
		<section className="py-20 bg-background" ref={ctaRef}>
			<div className="container px-6 md:px-8 mx-auto max-w-4xl">
				<motion.div
					animate={
						isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
					}
					className="text-center"
					initial={{ opacity: 0, y: hiddenY }}
					transition={{ duration: 0.35 }}
				>
					<motion.h2
						animate={
							isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
						}
						className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-4"
						initial={{ opacity: 0, y: hiddenY }}
						transition={{ duration: 0.35, delay: 0.05 }}
					>
						Start Building with{" "}
						<span className="text-primary">Proddy Today</span>
					</motion.h2>

					<motion.p
						animate={
							isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
						}
						className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto"
						initial={{ opacity: 0, y: hiddenY }}
						transition={{ duration: 0.35, delay: 0.1 }}
					>
						Create a workspace. Invite your team. Free to get started.
					</motion.p>

					<motion.div
						animate={
							isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
						}
						className="flex flex-col sm:flex-row gap-4 justify-center"
						initial={{ opacity: 0, y: hiddenY }}
						transition={{ duration: 0.35, delay: 0.15 }}
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
							className="gap-2 rounded-full px-8 py-3 text-base"
							size="lg"
							variant="outline"
						>
							<Link href="/pricing">See pricing</Link>
						</Button>
					</motion.div>

					<motion.p
						animate={
							isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
						}
						className="text-sm text-muted-foreground mt-6"
						initial={{ opacity: 0, y: hiddenY }}
						transition={{ duration: 0.35, delay: 0.2 }}
					>
						No credit card required • Free plan available • Full platform access
					</motion.p>
				</motion.div>
			</div>
		</section>
	);
};
