"use client";

import { motion, useInView } from "framer-motion";
import { useRef } from "react";

export const FAQSection = () => {
	const faqRef = useRef<HTMLDivElement>(null);
	const isFaqInView = useInView(faqRef, { once: true, margin: "-100px 0px" });

	return (
		<section className="py-20 bg-gray-50" ref={faqRef}>
			<div className="container px-6 md:px-8 mx-auto max-w-7xl">
				<div className="text-center mb-16">
					<motion.h2
						animate={isFaqInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5 }}
					>
						Frequently Asked Questions
					</motion.h2>
					<motion.p
						animate={isFaqInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="text-lg text-gray-600 max-w-3xl mx-auto"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.1 }}
					>
						Common questions about Proddy AI and how it works
					</motion.p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 gap-8">
					<motion.div
						animate={isFaqInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="space-y-6"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								How does Proddy AI access my workspace data?
							</h3>
							<p className="text-gray-600">
								Proddy AI only accesses the data within your workspace that it
								needs to answer your specific questions. It uses a secure
								retrieval system that maintains privacy and doesn't store or use
								your data for training purposes.
							</p>
						</div>

						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								Is my conversation with Proddy AI private?
							</h3>
							<p className="text-gray-600">
								Yes, your conversations with Proddy AI are private to your
								workspace. Only members of your workspace can see the chat
								history, and you can clear your conversation history at any
								time.
							</p>
						</div>

						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								Can Proddy AI create content for me?
							</h3>
							<p className="text-gray-600">
								While Proddy AI is primarily designed to retrieve and summarize
								information from your workspace, it can help with basic content
								creation tasks like drafting messages, summarizing meetings, and
								organizing information.
							</p>
						</div>
					</motion.div>

					<motion.div
						animate={isFaqInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
						className="space-y-6"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.3 }}
					>
						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								What types of questions can I ask Proddy AI?
							</h3>
							<p className="text-gray-600">
								You can ask Proddy AI about anything in your workspace: meeting
								schedules, project statuses, document contents, team updates,
								task assignments, and more. It works best with specific
								questions about your workspace content.
							</p>
						</div>

						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								Does Proddy AI learn from my team's usage?
							</h3>
							<p className="text-gray-600">
								Proddy AI maintains conversation context to provide more
								relevant responses, but it doesn't currently learn from your
								team's usage patterns over time. Each interaction is based on
								the current state of your workspace data.
							</p>
						</div>

						<div className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm">
							<h3 className="text-lg font-semibold mb-2 text-gray-900">
								Is Proddy AI free to use?
							</h3>
							<p className="text-gray-600">
								Yes, Proddy AI is completely free during our public beta period.
								We're using a freemium model where core AI features will remain
								free, with advanced features available in paid plans once we
								exit beta.
							</p>
						</div>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
