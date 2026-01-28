"use client";

import { motion, useInView } from "framer-motion";
import { Bot, Briefcase, CheckSquare, Code, Target, Users } from "lucide-react";
import { useRef } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { cn } from "@/lib/utils";

export const UseCasesSection = () => {
	const useCasesRef = useRef<HTMLDivElement>(null);
	const isUseCasesInView = useInView(useCasesRef, {
		once: true,
		margin: "-100px 0px",
	});

	// Tab configuration with colors and icons
	const tabConfig = [
		{
			id: "marketing",
			icon: <Target className="size-4 flex-shrink-0" />,
			label: "Marketing",
			color: "blue",
			hoverBg: "hover:bg-blue-50",
			hoverText: "hover:text-blue-600",
			activeBg: "data-[state=active]:bg-blue-100",
			activeText: "data-[state=active]:text-blue-700",
		},
		{
			id: "product",
			icon: <Briefcase className="size-4 flex-shrink-0" />,
			label: "Product",
			color: "green",
			hoverBg: "hover:bg-green-50",
			hoverText: "hover:text-green-600",
			activeBg: "data-[state=active]:bg-green-100",
			activeText: "data-[state=active]:text-green-700",
		},
		{
			id: "engineering",
			icon: <Code className="size-4 flex-shrink-0" />,
			label: "Engineering",
			color: "purple",
			hoverBg: "hover:bg-purple-50",
			hoverText: "hover:text-purple-600",
			activeBg: "data-[state=active]:bg-purple-100",
			activeText: "data-[state=active]:text-purple-700",
		},
		{
			id: "leadership",
			icon: <Users className="size-4 flex-shrink-0" />,
			label: "Leadership",
			color: "indigo",
			hoverBg: "hover:bg-indigo-50",
			hoverText: "hover:text-indigo-600",
			activeBg: "data-[state=active]:bg-indigo-100",
			activeText: "data-[state=active]:text-indigo-700",
		},
	];

	return (
		<section
			ref={useCasesRef}
			className="py-20 bg-gradient-to-b from-gray-50 to-white relative overflow-hidden"
		>
			{/* Background decorative elements */}
			<div className="absolute inset-0 overflow-hidden">
				<div className="absolute top-[20%] -right-[5%] w-[25%] h-[25%] rounded-full bg-primary/5 blur-3xl" />
				<div className="absolute bottom-[30%] -left-[5%] w-[30%] h-[30%] rounded-full bg-secondary/5 blur-3xl" />
			</div>

			<div className="container px-6 md:px-8 mx-auto max-w-7xl relative z-10">
				<div className="text-center mb-16">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5 }}
						className="mb-4"
					>
						<span className="inline-flex items-center px-3 py-1.5 text-sm font-medium rounded-full bg-primary/10 text-primary">
							<Bot className="mr-1 h-3.5 w-3.5" />
							Real-World Applications
						</span>
					</motion.div>
					<motion.h2
						initial={{ opacity: 0, y: 20 }}
						animate={
							isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.1 }}
						className="text-3xl md:text-5xl font-bold text-gray-900 mb-6"
					>
						How Teams Use{" "}
						<span className="text-primary relative">
							Proddy AI
							<span className="absolute bottom-1 left-0 w-full h-3 bg-secondary/20 -z-10 rounded-full" />
						</span>
					</motion.h2>
					<motion.p
						initial={{ opacity: 0, y: 20 }}
						animate={
							isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.2 }}
						className="text-lg md:text-xl text-gray-600 max-w-3xl mx-auto"
					>
						Real-world applications that boost productivity across different
						team functions
					</motion.p>
				</div>

				<Tabs defaultValue="marketing" className="w-full">
					<motion.div
						initial={{ opacity: 0, y: 20 }}
						animate={
							isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
						}
						transition={{ duration: 0.5, delay: 0.3 }}
						className="mb-12"
					>
						<TabsList className="grid grid-cols-2 md:grid-cols-4 gap-3 w-full h-16 max-w-4xl mx-auto bg-white p-2.5 rounded-xl shadow-sm border border-gray-200">
							{tabConfig.map((tab) => (
								<TabsTrigger
									key={tab.id}
									value={tab.id}
									className={cn(
										"relative py-3 px-4 text-sm font-medium text-gray-700 rounded-lg ring-1 ring-gray-200",
										tab.hoverBg,
										tab.hoverText,
										tab.activeBg,
										tab.activeText,
										"data-[state=active]:shadow-md data-[state=active]:font-semibold transition-all duration-200"
									)}
								>
									<span className="flex items-center justify-center gap-2">
										{tab.icon}
										<span className="hidden sm:inline">{tab.label}</span>
									</span>
								</TabsTrigger>
							))}
						</TabsList>
					</motion.div>

					<TabsContent
						value="marketing"
						className="mt-8 animate-in fade-in-50 duration-300"
					>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={
								isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
							}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
						>
							<div>
								<h3 className="text-2xl font-bold mb-4 text-gray-900">
									Marketing Teams
								</h3>
								<p className="text-gray-600 mb-6">
									Marketing teams use Proddy AI to streamline campaign planning,
									content creation, and performance tracking.
								</p>
								<ul className="space-y-4">
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Campaign Coordination
											</p>
											<p className="text-gray-600 text-sm">
												"What's the status of our Q3 social media campaign?"
												gets you instant updates on progress, deadlines, and
												assigned tasks.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Content Research
											</p>
											<p className="text-gray-600 text-sm">
												"Find all our blog posts about product features"
												instantly retrieves relevant content from your
												workspace.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Meeting Summaries
											</p>
											<p className="text-gray-600 text-sm">
												"Summarize yesterday's marketing strategy meeting"
												provides key points and action items at a glance.
											</p>
										</div>
									</li>
								</ul>
							</div>
							<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-all duration-300">
								<div className="flex items-center gap-3 mb-6">
									<div className="p-3 rounded-lg bg-blue-100 text-blue-600">
										<Bot className="h-6 w-6" />
									</div>
									<h4 className="text-xl font-bold text-gray-900">
										Example Conversation
									</h4>
								</div>
								<div className="space-y-4">
									<div className="bg-blue-50 text-gray-800 rounded-lg rounded-tr-none p-4 border-l-4 border-blue-500">
										<p className="font-medium">
											What's our content calendar for next week?
										</p>
									</div>
									<div className="bg-gray-50 text-gray-800 rounded-lg rounded-tl-none p-4 border-l-4 border-gray-400">
										<p className="mb-3 font-medium text-blue-600">
											Here's your content calendar for next week:
										</p>
										<ul className="space-y-2 pl-4 list-disc text-sm">
											<li>
												<strong>Monday:</strong> Blog post on "10 Productivity
												Tips" (Writer: Jamie)
											</li>
											<li>
												<strong>Wednesday:</strong> Product feature announcement
												for Canvas tool
											</li>
											<li>
												<strong>Thursday:</strong> Customer success story with
												Acme Corp
											</li>
											<li>
												<strong>Friday:</strong> Weekly newsletter and social
												media recap
											</li>
										</ul>
										<p className="text-xs text-gray-500 mt-3 italic">
											Sources: Marketing Calendar, Content Plan Q3
										</p>
									</div>
								</div>
							</div>
						</motion.div>
					</TabsContent>

					<TabsContent
						value="product"
						className="mt-8 animate-in fade-in-50 duration-300"
					>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={
								isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
							}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
						>
							<div>
								<h3 className="text-2xl font-bold mb-4 text-gray-900">
									Product Teams
								</h3>
								<p className="text-gray-600 mb-6">
									Product teams leverage Proddy AI to track feature development,
									manage roadmaps, and coordinate cross-functional work.
								</p>
								<ul className="space-y-4">
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Feature Tracking
											</p>
											<p className="text-gray-600 text-sm">
												"What's the status of the new dashboard feature?"
												provides current progress, blockers, and timeline.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Requirement Lookup
											</p>
											<p className="text-gray-600 text-sm">
												"Find the requirements for the mobile app redesign"
												instantly retrieves relevant documentation.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Sprint Planning
											</p>
											<p className="text-gray-600 text-sm">
												"What tasks are scheduled for our next sprint?" gives
												you a quick overview of upcoming work.
											</p>
										</div>
									</li>
								</ul>
							</div>
							<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-all duration-300">
								<div className="flex items-center gap-3 mb-6">
									<div className="p-3 rounded-lg bg-green-100 text-green-600">
										<Bot className="h-6 w-6" />
									</div>
									<h4 className="text-xl font-bold text-gray-900">
										Example Conversation
									</h4>
								</div>
								<div className="space-y-4">
									<div className="bg-green-50 text-gray-800 rounded-lg rounded-tr-none p-4 border-l-4 border-green-500">
										<p className="font-medium">
											When is the Canvas feature scheduled for release?
										</p>
									</div>
									<div className="bg-gray-50 text-gray-800 rounded-lg rounded-tl-none p-4 border-l-4 border-gray-400">
										<p className="mb-3 font-medium text-green-600">
											The Canvas feature is scheduled for release on October
											15th. According to the product roadmap, it's currently in
											the final testing phase with 85% of tasks completed. The
											engineering team has reported no critical blockers, and
											the design team signed off on the UI last week.
										</p>
										<p className="text-xs text-gray-500 mt-3 italic">
											Sources: Product Roadmap, Engineering Sprint Board
										</p>
									</div>
								</div>
							</div>
						</motion.div>
					</TabsContent>

					<TabsContent
						value="engineering"
						className="mt-8 animate-in fade-in-50 duration-300"
					>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={
								isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
							}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
						>
							<div>
								<h3 className="text-2xl font-bold mb-4 text-gray-900">
									Engineering Teams
								</h3>
								<p className="text-gray-600 mb-6">
									Engineering teams use Proddy AI to track development progress,
									manage sprints, and coordinate technical documentation.
								</p>
								<ul className="space-y-4">
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Sprint Management
											</p>
											<p className="text-gray-600 text-sm">
												"What tasks are still open in our current sprint?" gives
												you immediate visibility into remaining work.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Documentation Access
											</p>
											<p className="text-gray-600 text-sm">
												"Find the API documentation for the user service"
												instantly retrieves relevant technical docs.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Meeting Coordination
											</p>
											<p className="text-gray-600 text-sm">
												"When is our next code review scheduled?" provides
												immediate calendar information.
											</p>
										</div>
									</li>
								</ul>
							</div>
							<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-all duration-300">
								<div className="flex items-center gap-3 mb-6">
									<div className="p-3 rounded-lg bg-purple-100 text-purple-600">
										<Bot className="h-6 w-6" />
									</div>
									<h4 className="text-xl font-bold text-gray-900">
										Example Conversation
									</h4>
								</div>
								<div className="space-y-4">
									<div className="bg-purple-50 text-gray-800 rounded-lg rounded-tr-none p-4 border-l-4 border-purple-500">
										<p className="font-medium">
											What are the open bugs for the messaging feature?
										</p>
									</div>
									<div className="bg-gray-50 text-gray-800 rounded-lg rounded-tl-none p-4 border-l-4 border-gray-400">
										<p className="mb-3 font-medium text-purple-600">
											Here are the open bugs for the messaging feature:
										</p>
										<ul className="space-y-2 pl-4 list-disc text-sm">
											<li>
												<strong>BUG-423:</strong> Message notifications not
												appearing on mobile (Priority: High)
											</li>
											<li>
												<strong>BUG-427:</strong> Emoji reactions sometimes fail
												to save (Priority: Medium)
											</li>
											<li>
												<strong>BUG-430:</strong> Long messages cause layout
												issues in thread view (Priority: Low)
											</li>
										</ul>
										<p className="text-xs text-gray-500 mt-3 italic">
											Sources: Engineering Board, Bug Tracker
										</p>
									</div>
								</div>
							</div>
						</motion.div>
					</TabsContent>

					<TabsContent
						value="leadership"
						className="mt-8 animate-in fade-in-50 duration-300"
					>
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={
								isUseCasesInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }
							}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center"
						>
							<div>
								<h3 className="text-2xl font-bold mb-4 text-gray-900">
									Leadership Teams
								</h3>
								<p className="text-gray-600 mb-6">
									Leadership teams rely on Proddy AI for high-level insights,
									cross-team coordination, and strategic planning.
								</p>
								<ul className="space-y-4">
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Project Status
											</p>
											<p className="text-gray-600 text-sm">
												"What's the status of our Q3 initiatives?" provides a
												high-level overview across all teams.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Meeting Preparation
											</p>
											<p className="text-gray-600 text-sm">
												"Summarize the key points from last week's leadership
												meeting" helps with quick follow-ups.
											</p>
										</div>
									</li>
									<li className="flex items-start">
										<div className="flex-shrink-0 mt-1 bg-primary/10 p-1 rounded-full">
											<CheckSquare className="h-4 w-4 text-primary" />
										</div>
										<div className="ml-3">
											<p className="text-gray-800 font-medium">
												Strategic Planning
											</p>
											<p className="text-gray-600 text-sm">
												"Find all documents related to our 2024 strategy"
												instantly retrieves relevant materials.
											</p>
										</div>
									</li>
								</ul>
							</div>
							<div className="bg-white rounded-xl shadow-md p-8 border border-gray-100 hover:shadow-lg transition-all duration-300">
								<div className="flex items-center gap-3 mb-6">
									<div className="p-3 rounded-lg bg-indigo-100 text-indigo-600">
										<Bot className="h-6 w-6" />
									</div>
									<h4 className="text-xl font-bold text-gray-900">
										Example Conversation
									</h4>
								</div>
								<div className="space-y-4">
									<div className="bg-indigo-50 text-gray-800 rounded-lg rounded-tr-none p-4 border-l-4 border-indigo-500">
										<p className="font-medium">
											Give me a status update on our key Q3 initiatives
										</p>
									</div>
									<div className="bg-gray-50 text-gray-800 rounded-lg rounded-tl-none p-4 border-l-4 border-gray-400">
										<p className="mb-3 font-medium text-indigo-600">
											Here's the current status of your key Q3 initiatives:
										</p>
										<ul className="space-y-2 pl-4 list-disc text-sm">
											<li>
												<strong>Product Launch (Canvas Feature):</strong> 85%
												complete, on track for Oct 15 release
											</li>
											<li>
												<strong>Marketing Campaign:</strong> 70% complete,
												content creation phase, on schedule
											</li>
											<li>
												<strong>Customer Success Program:</strong> 50% complete,
												training materials delayed by 1 week
											</li>
											<li>
												<strong>Engineering Infrastructure:</strong> 90%
												complete, ahead of schedule
											</li>
										</ul>
										<p className="text-xs text-gray-500 mt-3 italic">
											Sources: Strategic Planning, Team Updates, Project Boards
										</p>
									</div>
								</div>
							</div>
						</motion.div>
					</TabsContent>
				</Tabs>
			</div>
		</section>
	);
};
