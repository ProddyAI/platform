"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { Brain, Calendar, type LucideIcon, Search } from "lucide-react";
import { useRef } from "react";

type Feature = {
	icon: LucideIcon;
	title: string;
	body: string;
	points: string[];
};

const FEATURES: Feature[] = [
	{
		icon: Search,
		title: "Contextual Search",
		body: "Instantly find information across your workspace with natural-language queries that understand your team's context.",
		points: [
			"Searches messages, tasks, notes, and more",
			"Understands natural-language questions",
			"Cites a source for every answer",
		],
	},
	{
		icon: Calendar,
		title: "Schedule Intelligence",
		body: "Get quick insights about your meetings, events, and deadlines without digging through calendars.",
		points: [
			"Summarizes today's meetings and events",
			"Surfaces upcoming deadline reminders",
			"Helps coordinate team availability",
		],
	},
	{
		icon: Brain,
		title: "Workspace Memory",
		body: "Proddy AI keeps your team's context and prior interactions in view to give more relevant assistance.",
		points: [
			"Draws on your workspace's current data",
			"Maintains conversation context",
			"Uses that context for sharper answers",
		],
	},
];

export const FeaturesSection = () => {
	const featuresRef = useRef<HTMLDivElement>(null);
	const isInView = useInView(featuresRef, { once: true, margin: "-100px 0px" });
	const reduceMotion = useReducedMotion();

	return (
		<section className="bg-background py-20" id="features" ref={featuresRef}>
			<div className="container mx-auto max-w-7xl px-6 md:px-8">
				<div className="mx-auto mb-16 max-w-2xl text-center">
					<m.h2
						animate={isInView ? { opacity: 1, y: 0 } : {}}
						className="text-balance text-3xl font-bold text-foreground md:text-4xl"
						initial={reduceMotion ? false : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
					>
						Everything Proddy AI knows about your work
					</m.h2>
					<m.p
						animate={isInView ? { opacity: 1, y: 0 } : {}}
						className="mt-4 text-pretty text-lg text-muted-foreground"
						initial={reduceMotion ? false : { opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
					>
						Three ways it turns scattered context into answers you can act on.
					</m.p>
				</div>

				<div className="grid grid-cols-1 gap-6 md:grid-cols-3">
					{FEATURES.map((feature, i) => (
						<m.article
							animate={isInView ? { opacity: 1, y: 0 } : {}}
							className="group relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-sm transition-[transform,box-shadow,border-color] duration-300 ease-out hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
							initial={reduceMotion ? false : { opacity: 0, y: 24 }}
							key={feature.title}
							transition={{
								duration: 0.5,
								delay: reduceMotion ? 0 : 0.15 + i * 0.12,
								ease: [0.16, 1, 0.3, 1],
							}}
						>
							{/* Accent wash that warms on hover. */}
							<div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-primary/[0.05] to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

							<div className="relative">
								<span className="grid size-12 place-items-center rounded-xl bg-primary/10 text-primary transition-transform duration-300 ease-out group-hover:scale-105">
									<feature.icon className="size-6" />
								</span>
								<h3 className="mt-5 text-xl font-semibold text-foreground">
									{feature.title}
								</h3>
								<p className="mt-2 text-muted-foreground">{feature.body}</p>
								<ul className="mt-4 space-y-2">
									{feature.points.map((point) => (
										<li
											className="flex items-start gap-2.5 text-sm text-muted-foreground"
											key={point}
										>
											<span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary/50" />
											{point}
										</li>
									))}
								</ul>
							</div>
						</m.article>
					))}
				</div>
			</div>
		</section>
	);
};
