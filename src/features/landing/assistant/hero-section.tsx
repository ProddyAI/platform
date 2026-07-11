"use client";

import { motion, useInView } from "framer-motion";
import { ArrowRight, Bot, Lock, MessageSquare, Send, Zap } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export const HeroSection = () => {
	const heroRef = useRef<HTMLDivElement>(null);
	const isHeroInView = useInView(heroRef, { once: true, margin: "-100px 0px" });

	return (
		<section
			className="relative w-full pt-32 pb-16 md:pt-40 md:pb-24 overflow-hidden bg-gradient-to-b from-background via-muted/50 to-muted"
			ref={heroRef}
		>
			<div className="container px-6 md:px-8 mx-auto relative z-10 max-w-6xl">
				<motion.div
					animate={isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
					className="flex flex-col items-center text-center"
					initial={{ opacity: 0, y: 20 }}
					transition={{ duration: 0.5 }}
				>
					<motion.h1
						animate={
							isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						className="text-4xl md:text-6xl font-bold tracking-tight text-foreground mb-4 max-w-4xl"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.2 }}
					>
						Just Ask, <span className="text-primary">Proddy Knows</span>
					</motion.h1>

					<motion.div
						animate={
							isHeroInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						className="flex flex-col sm:flex-row gap-4 justify-center mt-8"
						initial={{ opacity: 0, y: 20 }}
						transition={{ duration: 0.5, delay: 0.4 }}
					>
						<Link href="/auth/signup">
							<Button
								className="gap-2 rounded-full text-primary-foreground bg-primary hover:bg-primary/90 px-6 py-2 shadow-md"
								size="lg"
							>
								Try Proddy AI <ArrowRight className="size-4" />
							</Button>
						</Link>
						<Link href="#features">
							<Button
								className="gap-2 rounded-full bg-card border-border text-foreground hover:bg-accent px-6 py-2"
								size="lg"
								variant="outline"
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
							animate={
								isHeroInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -20 }
							}
							initial={{ opacity: 0, x: -20 }}
							transition={{ duration: 0.5, delay: 0.5 }}
						>
							<Badge className="mb-4 bg-primary/10 text-primary hover:bg-primary/20 border-0">
								Dashboard Integration
							</Badge>
							<p className="text-muted-foreground mb-6">
								Proddy AI lives in your team&apos;s dashboard, making it
								instantly accessible whenever you need assistance. No need to
								switch contexts or open new tools – just ask your question and
								get immediate answers.
							</p>

							<div className="space-y-4 mb-8">
								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<Zap className="size-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-foreground">
											Instant Answers
										</h4>
										<p className="text-muted-foreground">
											Get immediate responses to your questions about workspace
											content, schedules, and team activities.
										</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<Lock className="size-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-foreground">
											Privacy-Focused
										</h4>
										<p className="text-muted-foreground">
											Your workspace data stays private. Proddy AI only accesses
											the information it needs to answer your specific
											questions.
										</p>
									</div>
								</div>

								<div className="flex items-start">
									<div className="flex-shrink-0 mt-1">
										<MessageSquare className="size-5 text-primary" />
									</div>
									<div className="ml-4">
										<h4 className="text-lg font-medium text-foreground">
											Conversational Interface
										</h4>
										<p className="text-muted-foreground">
											Chat naturally with Proddy AI just like you would with a
											team member. No special commands or syntax required.
										</p>
									</div>
								</div>
							</div>
						</motion.div>

						<motion.div
							animate={
								isHeroInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }
							}
							className="relative"
							initial={{ opacity: 0, x: 20 }}
							transition={{ duration: 0.5, delay: 0.7 }}
						>
							<div className="bg-card rounded-2xl shadow-lg overflow-hidden border border-border">
								<div className="p-4 bg-primary/10 border-b border-border">
									<div className="flex items-center gap-2">
										<Bot className="size-5 text-primary" />
										<h3 className="font-semibold text-foreground">Proddy AI</h3>
									</div>
								</div>
								<div className="p-6 space-y-6 h-[500px] overflow-y-auto">
									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-foreground rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>How&apos;s my day looking?</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex">
										<div className="bg-muted text-foreground rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<p className="text-sm">
												Good morning! Here&apos;s your day ahead:
												<br />
												<br />📅{" "}
												<span className="font-semibold">3 meetings</span> -
												Sprint planning at 10am, 1:1 with Priya at 2pm, design
												review at 4pm
												<br />✅ <span className="font-semibold">Tasks:</span> 4
												due today, 1 overdue (Update onboarding flow)
											</p>
										</div>
									</div>

									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-foreground rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>
												What&apos;s the context for the 10am sprint planning?
											</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex">
										<div className="bg-muted text-foreground rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<p className="text-sm">
												Sprint Planning - 10:00-10:30am
												<br />
												<br />
												<span className="font-semibold">Agenda:</span>
												<br />• Review completed stories from last sprint
												<br />• Plan capacity for the upcoming sprint
												<br />
												<br />
												<span className="font-semibold">Attendees:</span> You,
												Priya, Marcus
											</p>
										</div>
									</div>

									{/* User Message */}
									<div className="flex justify-end">
										<div className="bg-primary/10 text-foreground rounded-lg rounded-tr-none p-3 max-w-[80%]">
											<p>Show me a summary of the #product-launch channel</p>
										</div>
									</div>

									{/* AI Response */}
									<div className="flex">
										<div className="bg-muted text-foreground rounded-lg rounded-tl-none p-3 max-w-[80%]">
											<p className="text-sm">
												#product-launch - last 24 hours
												<br />
												<br />
												14 new messages. Priya flagged a blocker on the pricing
												page copy, and Marcus confirmed the launch checklist is
												on track for Friday.
											</p>
										</div>
									</div>
								</div>
								<div className="p-4 border-t border-border bg-card">
									<div className="flex gap-2">
										<input
											className="flex-1 border border-input rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
											disabled
											placeholder="Ask a question about your workspace..."
											type="text"
										/>
										<Button
											aria-label="Send message"
											className="bg-primary hover:bg-primary/90"
											disabled
											size="sm"
										>
											<Send className="size-4" />
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
