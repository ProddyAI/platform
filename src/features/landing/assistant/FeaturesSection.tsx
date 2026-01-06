"use client";

import { motion, useInView } from "framer-motion";
import { Brain, Calendar, Search } from "lucide-react";
import { useRef } from "react";

export const FeaturesSection = () => {
	const featuresRef = useRef<HTMLDivElement>(null);
	const isFeaturesInView = useInView(featuresRef, {
		once: true,
		margin: "-100px 0px",
	});

	return (
		<section id="features" ref={featuresRef} className="py-20 bg-white">
			<div className="container px-6 md:px-8 mx-auto max-w-7xl">
				<div className="text-center mb-16">
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						animate={
							isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5 }}
						className="text-3xl md:text-4xl font-bold text-gray-900 mb-4"
					>
						Key Features of Proddy AI
					</motion.h2>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={
							isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="text-lg text-gray-600 max-w-3xl mx-auto"
					>
						Designed to enhance your team's productivity with contextual
						intelligence
					</motion.p>
				</div>

				<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
					{/* Feature 1 */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Search className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">Contextual Search</h3>
						<p className="text-gray-600 mb-4">
							Instantly find information across your workspace with natural
							language queries that understand your team's context.
						</p>
						<ul className="space-y-2">
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Searches across messages, tasks, notes, and more
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Understands natural language questions
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Provides source references for all answers
								</span>
							</li>
						</ul>
					</motion.div>

					{/* Feature 2 */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.3 }}
						className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Calendar className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">
							Schedule Intelligence
						</h3>
						<p className="text-gray-600 mb-4">
							Get quick insights about your meetings, events, and deadlines
							without digging through calendars.
						</p>
						<ul className="space-y-2">
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Summarizes today's meetings and events
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Provides upcoming deadline reminders
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Helps coordinate team availability
								</span>
							</li>
						</ul>
					</motion.div>

					{/* Feature 3 */}
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isFeaturesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.4 }}
						className="bg-white rounded-xl p-6 border border-gray-100 shadow-sm hover:shadow-md transition-all duration-300"
					>
						<div className="bg-primary/10 p-3 rounded-full w-fit mb-4">
							<Brain className="text-primary h-6 w-6" />
						</div>
						<h3 className="text-xl font-semibold mb-2">Workspace Memory</h3>
						<p className="text-gray-600 mb-4">
							Proddy AI remembers your team's context and previous interactions
							to provide more relevant assistance.
						</p>
						<ul className="space-y-2">
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Learns from team interactions over time
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Maintains conversation context
								</span>
							</li>
							<li className="flex items-start">
								<div className="mr-2 mt-1 text-primary">•</div>
								<span className="text-sm text-gray-600">
									Provides increasingly personalized responses
								</span>
							</li>
						</ul>
					</motion.div>
				</div>
			</div>
		</section>
	);
};
