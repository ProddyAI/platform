"use client";

import { motion, useInView, useReducedMotion } from "framer-motion";
import { Brain, Calendar, Search } from "lucide-react";
import { useRef } from "react";

export const FeaturesSection = () => {
	const featuresRef = useRef<HTMLDivElement>(null);
	const isFeaturesInView = useInView(featuresRef, {
		once: true,
		margin: "-100px 0px",
	});
	const shouldReduceMotion = useReducedMotion();

	return (
		<section className="py-20 bg-background" id="features" ref={featuresRef}>
			<div className="container px-6 md:px-8 mx-auto max-w-7xl">
				<div className="text-center mb-16">
					<motion.h2
						animate={
							isFeaturesInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="text-3xl md:text-4xl font-bold text-foreground mb-4"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5 }}
					>
						Key Features of Proddy AI
					</motion.h2>
					<motion.p
						animate={
							isFeaturesInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="text-lg text-muted-foreground max-w-3xl mx-auto"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Designed to enhance your team&apos;s productivity with contextual
						intelligence
					</motion.p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{/* Feature 1 */}
					<motion.div
						animate={
							isFeaturesInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Search className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">Contextual Search</h3>
						<p className="text-muted-foreground mb-4">
							Instantly find information across your workspace with natural
							language queries that understand your team&apos;s context.
						</p>
						<ul className="space-y-2 list-disc pl-5 marker:text-primary">
							<li className="text-sm text-muted-foreground">
								Searches across messages, tasks, notes, and more
							</li>
							<li className="text-sm text-muted-foreground">
								Understands natural language questions
							</li>
							<li className="text-sm text-muted-foreground">
								Provides source references for all answers
							</li>
						</ul>
					</motion.div>

					{/* Feature 2 */}
					<motion.div
						animate={
							isFeaturesInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Calendar className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">
							Schedule Intelligence
						</h3>
						<p className="text-muted-foreground mb-4">
							Get quick insights about your meetings, events, and deadlines
							without digging through calendars.
						</p>
						<ul className="space-y-2 list-disc pl-5 marker:text-primary">
							<li className="text-sm text-muted-foreground">
								Summarizes today&apos;s meetings and events
							</li>
							<li className="text-sm text-muted-foreground">
								Provides upcoming deadline reminders
							</li>
							<li className="text-sm text-muted-foreground">
								Helps coordinate team availability
							</li>
						</ul>
					</motion.div>

					{/* Feature 3 */}
					<motion.div
						animate={
							isFeaturesInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="bg-card rounded-xl p-6 border border-border shadow-sm hover:shadow-md transition-all duration-300"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: 0.4 }}
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Brain className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">Workspace Memory</h3>
						<p className="text-muted-foreground mb-4">
							Proddy AI remembers your team&apos;s context and previous
							interactions to provide more relevant assistance.
						</p>
						<ul className="space-y-2 list-disc pl-5 marker:text-primary">
							<li className="text-sm text-muted-foreground">
								Draws on your workspace&apos;s current data
							</li>
							<li className="text-sm text-muted-foreground">
								Maintains conversation context
							</li>
							<li className="text-sm text-muted-foreground">
								Uses that context to give more relevant answers
							</li>
						</ul>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
