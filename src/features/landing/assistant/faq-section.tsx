"use client";

import { m, useInView, useReducedMotion } from "framer-motion";
import { useRef } from "react";

export const FAQSection = () => {
	const faqRef = useRef<HTMLDivElement>(null);
	const isFaqInView = useInView(faqRef, { once: true, margin: "-100px 0px" });
	const shouldReduceMotion = useReducedMotion();

	return (
		<section className="py-20 bg-muted/50" ref={faqRef}>
			<div className="container px-6 md:px-8 mx-auto max-w-7xl">
				<div className="text-center mb-16">
					<m.h2
						animate={
							isFaqInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="text-3xl md:text-4xl font-bold text-foreground mb-4"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5 }}
					>
						Frequently Asked Questions
					</m.h2>
					<m.p
						animate={
							isFaqInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="text-lg text-muted-foreground max-w-3xl mx-auto"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.1 }}
					>
						Common questions about Proddy AI and how it works
					</m.p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					<m.div
						animate={
							isFaqInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="space-y-6"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.2 }}
					>
						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								How does Proddy AI access my workspace data?
							</h3>
							<p className="text-muted-foreground">
								Proddy AI only accesses the data within your workspace that it
								needs to answer your specific questions. It uses a secure
								retrieval system that maintains privacy and doesn&apos;t store
								or use your data for training purposes.
							</p>
						</div>

						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								Is my conversation with Proddy AI private?
							</h3>
							<p className="text-muted-foreground">
								Yes, your conversations with Proddy AI are private to your
								workspace. Only members of your workspace can see the chat
								history, and you can clear your conversation history at any
								time.
							</p>
						</div>

						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								Can Proddy AI create content for me?
							</h3>
							<p className="text-muted-foreground">
								While Proddy AI is primarily designed to retrieve and summarize
								information from your workspace, it can help with basic content
								creation tasks like drafting messages, summarizing meetings, and
								organizing information.
							</p>
						</div>
					</m.div>

					<m.div
						animate={
							isFaqInView
								? { opacity: 1, y: 0 }
								: { opacity: 0, y: shouldReduceMotion ? 0 : 20 }
						}
						className="space-y-6"
						initial={{ opacity: 0, y: shouldReduceMotion ? 0 : 20 }}
						transition={{ duration: 0.5, delay: shouldReduceMotion ? 0 : 0.3 }}
					>
						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								What types of questions can I ask Proddy AI?
							</h3>
							<p className="text-muted-foreground">
								You can ask Proddy AI about anything in your workspace: meeting
								schedules, project statuses, document contents, team updates,
								task assignments, and more. It works best with specific
								questions about your workspace content.
							</p>
						</div>

						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								Does Proddy AI learn from my team&apos;s usage?
							</h3>
							<p className="text-muted-foreground">
								Proddy AI maintains conversation context to provide more
								relevant responses, but it doesn&apos;t currently learn from
								your team&apos;s usage patterns over time. Each interaction is
								based on the current state of your workspace data.
							</p>
						</div>

						<div className="bg-card rounded-2xl p-6 border border-border shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-foreground">
								Is Proddy AI free to use?
							</h3>
							<p className="text-muted-foreground">
								Yes, core Proddy AI features are free on every plan. Higher AI
								usage limits and advanced features are available on our paid
								plans — see the pricing page for details.
							</p>
						</div>
					</m.div>
				</div>
			</div>
		</section>
	);
};
