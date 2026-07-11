"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { Check, X } from "lucide-react";
import Image from "next/image";
import { useRef } from "react";

interface ComparisonItemProps {
	title: string;
	traditional: string;
	proddy: string;
	delay: number;
}

const ComparisonItem = ({
	title,
	traditional,
	proddy,
	delay,
}: ComparisonItemProps) => {
	const itemRef = useRef<HTMLDivElement>(null);
	const isItemInView = useInView(itemRef, { once: true, margin: "-50px 0px" });
	const shouldReduceMotion = useReducedMotion();

	return (
		<motion.div
			animate={isItemInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 12 }}
			className="grid grid-cols-1 md:grid-cols-3 gap-4 py-4 border-b border-border"
			initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
			ref={itemRef}
			transition={{ duration: 0.35, delay: delay * 0.06 }}
		>
			<div className="font-medium text-foreground">{title}</div>
			<div className="flex items-center gap-2">
				<X
					aria-hidden="true"
					className="size-4 text-destructive flex-shrink-0"
				/>
				<span className="text-muted-foreground">
					<span className="md:hidden font-semibold text-foreground mr-1">
						Traditional Tools:
					</span>
					{traditional}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<Check
					aria-hidden="true"
					className="size-4 text-success flex-shrink-0"
				/>
				<span className="text-foreground font-medium">
					<span className="md:hidden font-semibold mr-1">Proddy:</span>
					{proddy}
				</span>
			</div>
		</motion.div>
	);
};

export const ComparisonSection = () => {
	const whySectionRef = useRef<HTMLDivElement>(null);
	const isWhySectionInView = useInView(whySectionRef, {
		once: true,
		margin: "-100px 0px",
	});
	const shouldReduceMotion = useReducedMotion();

	const comparisonItems = [
		{
			title: "Tool Management",
			traditional: "Multiple disconnected tools with separate logins",
			proddy: "Single platform with integrated modules",
		},
		{
			title: "Context Switching",
			traditional: "Constant switching between apps disrupts focus",
			proddy: "Seamless workflow with everything in one place",
		},
		{
			title: "Learning Curve",
			traditional: "Multiple interfaces to learn and manage",
			proddy: "Consistent, intuitive interface across all modules",
		},
	];

	return (
		<section
			className="py-12 md:py-16 bg-background relative overflow-hidden w-full"
			id="why-proddy"
			ref={whySectionRef}
		>
			<div className="w-full px-6 md:px-8 relative z-10">
				<div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-center max-w-7xl mx-auto">
					<div>
						<motion.h2
							animate={
								isWhySectionInView
									? { opacity: 1, y: 0 }
									: { opacity: 0, y: 12 }
							}
							className="text-3xl md:text-4xl font-bold tracking-tight text-foreground mb-3"
							initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 12 }}
							transition={{ duration: 0.35, delay: 0.05 }}
						>
							Less Context Switching
						</motion.h2>

						<div className="rounded-2xl border bg-card p-4 mb-6">
							<div className="hidden md:grid md:grid-cols-3 gap-3 mb-3 text-sm font-semibold">
								<div className="text-muted-foreground">Feature</div>
								<div className="text-muted-foreground">Traditional Tools</div>
								<div className="text-muted-foreground">Proddy</div>
							</div>

							{comparisonItems.map((item, index) => (
								<ComparisonItem
									delay={index + 3}
									key={item.title}
									proddy={item.proddy}
									title={item.title}
									traditional={item.traditional}
								/>
							))}
						</div>
					</div>

					<motion.div
						animate={
							isWhySectionInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 24 }
						}
						className="relative"
						initial={{ opacity: 0, x: shouldReduceMotion ? 0 : 24 }}
						transition={{ duration: 0.4, delay: 0.15 }}
					>
						<div className="relative rounded-2xl border bg-card shadow-lg overflow-hidden p-1">
							<Image
								alt="Proddy vs Traditional Tools"
								className="w-full h-auto rounded-xl"
								height={700}
								src="/dashboard-preview.svg"
								width={600}
							/>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
