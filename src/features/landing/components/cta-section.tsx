"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
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
			<div className="container px-6 md:px-8 mx-auto max-w-5xl">
				<m.div
					animate={
						isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
					}
					className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 md:px-16 md:py-20 text-center shadow-xl"
					initial={{ opacity: 0, y: hiddenY }}
					transition={{ duration: 0.35 }}
				>
					{/* Interior glow — a magenta garnish and a light lift keep the deep
					    purple panel from reading flat. */}
					<div aria-hidden className="pointer-events-none absolute inset-0">
						<div className="absolute -right-16 -top-20 size-80 rounded-full bg-secondary/30 blur-[110px]" />
						<div className="absolute -bottom-24 -left-10 size-80 rounded-full bg-white/10 blur-[110px]" />
					</div>

					<div className="relative">
						<m.h2
							animate={
								isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
							}
							className="text-3xl md:text-4xl font-bold tracking-tight text-white mb-4"
							initial={{ opacity: 0, y: hiddenY }}
							transition={{ duration: 0.35, delay: 0.05 }}
						>
							Start Building with Proddy Today
						</m.h2>

						<m.p
							animate={
								isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
							}
							className="text-lg text-white/80 mb-8 max-w-2xl mx-auto"
							initial={{ opacity: 0, y: hiddenY }}
							transition={{ duration: 0.35, delay: 0.1 }}
						>
							Create a workspace. Invite your team. Free to get started.
						</m.p>

						<m.div
							animate={
								isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
							}
							className="flex flex-col sm:flex-row gap-4 justify-center"
							initial={{ opacity: 0, y: hiddenY }}
							transition={{ duration: 0.35, delay: 0.15 }}
						>
							<Button
								asChild
								className="gap-2 rounded-full bg-white text-primary hover:bg-white/90 px-8 py-3 shadow-md text-base"
								size="lg"
							>
								<Link href="/auth/signup">
									Get Started Free <ArrowRight className="size-4" />
								</Link>
							</Button>
							<Button
								asChild
								className="gap-2 rounded-full border-white/30 bg-transparent text-white hover:bg-white/10 hover:text-white px-8 py-3 text-base"
								size="lg"
								variant="outline"
							>
								<Link href="/pricing">See pricing</Link>
							</Button>
						</m.div>

						<m.p
							animate={
								isCtaInView ? { opacity: 1, y: 0 } : { opacity: 0, y: hiddenY }
							}
							className="text-sm text-white/70 mt-6"
							initial={{ opacity: 0, y: hiddenY }}
							transition={{ duration: 0.35, delay: 0.2 }}
						>
							No credit card required • Free plan available • Full platform
							access
						</m.p>
					</div>
				</m.div>
			</div>
		</section>
	);
};
