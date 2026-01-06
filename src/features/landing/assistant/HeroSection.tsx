"use client";

import { motion, useInView } from "framer-motion";
import {
	ArrowRight,
	Bot,
	Lock,
	MessageSquare,
	Send,
	Sparkles,
	Zap,
} from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
	const heroRef = useRef<HTMLDivElement>(null);
	const isHeroInView = useInView(heroRef, { once: true, margin: "-100px 0px" });

	return (
		<section
			ref={heroRef}
			className="relative w-full pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden bg-gradient-to-b from-white via-gray-50/50 to-gray-50"
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute -top-[30%] -right-[10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute -bottom-[20%] -left-[10%] w-[50%] h-[50%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-6xl">
				<motion.div
					className="flex flex-col items-center text-center"
					initial={{ opacity: 0, y: 20 }}
					animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
					transition={{ duration: 0.5 }}
				>
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="mb-4"
					>
						<span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary">
							<Sparkles className="mr-1 h-3.5 w-3.5" />
							AI-Powered Workspace Assistant
						</span>
					</motion.div>

					<motion.h1
						initial={{ opacity: 0, y: 20 }}
						animate={
							isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="text-4xl md:text-6xl font-bold tracking-tight text-gray-900 mb-4 max-w-4xl"
					>
						Just Ask,{" "}
						<span className="text-primary relative">
							Proddy Knows
							<span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full"></span>
						</span>
					</motion.h1>

					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.4 }}
						className="flex flex-col sm:flex-row gap-4 justify-center mt-5 "
					>
						<Link href="/signup">
							<Button
								size="lg"
								className="gap-2 rounded-full text-white bg-primary hover:bg-primary/90 px-6 py-2 shadow-md"
							>
								Try Proddy AI <ArrowRight className="size-4" />
							</Button>
						</Link>
						<Link href="#features">
							<Button
								size="lg"
								variant="outline"
								className="gap-2 rounded-full bg-white border-slate-300 text-slate-700 hover:bg-slate-100 px-6 py-2"
							>
								Learn More
							</Button>
						</Link>
					</motion.div>
				</motion.div>
			</div>

			{/* Demo Section Content - Full Width */}
			<div className="mt-16 w-full relative z-10">
				<div className="w-full px-6 md:px-12 lg:px-16 xl:px-20">
					<div className="grid grid-cols-1 lg:grid-cols-[35fr_65fr] gap-8 lg:gap-12 xl:gap-16 items-center">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={
								isHeroInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }
							}
							transition={{ duration: 0.5, delay: 0.5 }}
						>
							<Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-0">
								Dashboard Integration
							</Badge>
							<p className="text-gray-600 mb-6">
								Proddy AI lives in your team's dashboard, making it instantly
								accessible whenever you need assistance. No need to switch
								contexts or open new tools – just ask your question and get
								immediate answers.
							</p>

							<div className="space-y-4 mb-8">
								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<Zap className="h-5 w-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-gray-900">
											Instant Answers
										</h4>
										<p className="text-gray-600">
											Get immediate responses to your questions about workspace
											content, schedules, and team activities.
										</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<Lock className="h-5 w-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-gray-900">
											Privacy-Focused
										</h4>
										<p className="text-gray-600">
											Your workspace data stays private. Proddy AI only accesses
											the information it needs to answer your specific
											questions.
										</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<MessageSquare className="h-5 w-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-gray-900">
											Conversational Interface
										</h4>
										<p className="text-gray-600">
											Chat naturally with Proddy AI just like you would with a
											team member. No special commands or syntax required.
										</p>
									</div>
								</div>
							</div>
						</motion.div>

						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={
								isHeroInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }
							}
							transition={{ duration: 0.5, delay: 0.7 }}
							className="relative"
						>
							<div className="bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
								<div className="p-4 bg-primary/10 border-b border-gray-200">
									<div className="flex items-center gap-2">
										<Bot className="h-5 w-5 text-primary" />
										<h3 className="font-semibold text-gray-800">Proddy AI</h3>
									</div>
								</div>
								<div className="p-6 space-y-6 h-[500px] overflow-y-auto">
									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-gray-800 rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>How's my day looking?</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex">
										<div className="bg-gray-100 text-gray-800 rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<p className="text-sm">
												Good morning! Here's your day ahead:
												<br />
												<br />📅{" "}
												<span className="font-semibold">3 meetings</span> -
												Sprint planning at 10am (high priority)
												<br />📧{" "}
												<span className="font-semibold">12 unread emails</span>{" "}
												- 2 urgent from stakeholders
												<br />🚨{" "}
												<span className="font-semibold">1 P1 incident</span> -
												Database performance issue (assigned to Sarah)
												<br />📊{" "}
												<span className="font-semibold">Projects:</span> Payment
												API (on track), Mobile App (2 days behind)
											</p>
										</div>
									</div>

									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-gray-800 rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>What's the context for the 10am sprint planning?</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex">
										<div className="bg-gray-100 text-gray-800 rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<p className="text-sm">
												Sprint Planning - Q2 Feature Development
												<br />
												<br />
												<span className="font-semibold">Agenda:</span>
												<br />• Review completed stories from last sprint
												<br />• Plan capacity for upcoming sprint
												<br />• Discuss mobile app delays
												<br />
												<br />
												<span className="font-semibold">Attendees:</span> Your
												team + Product Manager Lisa
												<br />
												<span className="font-semibold">Prep needed:</span>{" "}
												Review velocity metrics and blocker analysis
											</p>
										</div>
									</div>

									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-gray-800 rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>
												Show me a summary of the #engineering-alerts channel
											</p>
										</div>
									</div>

									{/* Typing Indicator */}
									<div className="flex">
										<div className="bg-gray-100 text-gray-800 rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<div className="flex items-center gap-2">
												<div className="flex space-x-1">
													<div
														className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
														style={{ animationDelay: "0ms" }}
													></div>
													<div
														className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
														style={{ animationDelay: "150ms" }}
													></div>
													<div
														className="h-2 w-2 rounded-full bg-gray-400 animate-bounce"
														style={{ animationDelay: "300ms" }}
													></div>
												</div>
											</div>
										</div>
									</div>
								</div>
								<div className="p-4 border-t border-gray-200 bg-white">
									<div className="flex gap-2">
										<input
											type="text"
											placeholder="Ask a question about your workspace..."
											className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
											disabled
										/>
										<Button
											size="sm"
											className="bg-primary hover:bg-primary/90"
										>
											<Send className="h-4 w-4" />
										</Button>
									</div>
								</div>
							</div>
						</motion.div>
					</div>
				</div>
			</div>
		</section>
	);
};
