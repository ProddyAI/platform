"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const PricingPage = () => {
	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<section className="py-20 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5 }}
						>
							BETA PRICING
						</motion.div>
						<motion.h1
							animate={{ opacity: 1, y: 0 }}
							className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Free for everyone during{" "}
							<span className="text-primary">beta</span>
						</motion.h1>
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="text-xl text-gray-600 max-w-3xl mx-auto mb-10"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							All features are unlocked while we’re in beta. Pricing below shows
							planned tiers and limits for launch.
						</motion.p>
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section className="py-16 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{/* Free Plan */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.3 }}
						>
							<h3 className="text-lg font-semibold mb-2">Free</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$0</span>
							</div>
							<p className="text-gray-600 mb-6">
								Quickly meet your core design needs
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Core Features</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">5 GB Storage</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">5 Users</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Community Support</span>
								</li>
							</ul>
							<Link href="/auth/signup">
								<Button className="w-full">
									Get Started <ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
						</motion.div>

						{/* Pro Plan */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							<h3 className="text-lg font-semibold mb-2">Pro</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$5</span>
								<span className="text-gray-500 ml-2">Per User / month</span>
							</div>
							<p className="text-gray-600 mb-6">
								Full-service creative for your team
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Advanced Features</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">25 GB Storage</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">25 Users</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Priority Support</span>
								</li>
							</ul>
							<Button className="w-full" disabled variant="outline">
								Available after beta
							</Button>
						</motion.div>

						{/* Enterprise Plan */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.6 }}
						>
							<h3 className="text-lg font-semibold mb-2">Enterprise</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">Custom</span>
							</div>
							<p className="text-gray-600 mb-6">For large organizations</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited Storage</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">SSO & Compliance</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Dedicated support</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Custom Integration</span>
								</li>
							</ul>
							<Link href="/contact">
								<Button className="w-full" variant="outline">
									Contact Sales
								</Button>
							</Link>
						</motion.div>
					</div>

					{/* View Comparison Button */}
					<div className="mt-12 text-center">
						<a href="#comparison">
							<Button size="lg" variant="outline">
								View full comparison
							</Button>
						</a>
					</div>
				</div>
			</section>

			<section className="py-16 bg-white" id="comparison">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="mb-10">
						<h2 className="text-3xl font-semibold text-gray-900">
							Full feature comparison
						</h2>
						<p className="text-gray-600 mt-3">
							A detailed breakdown by category, with limits and availability per
							tier.
						</p>
					</div>
					<div className="space-y-8">
						<div className="overflow-x-auto border border-gray-100 rounded-2xl">
							<table className="min-w-full text-sm">
								<thead className="bg-gray-50 text-gray-500">
									<tr>
										<th className="py-4 px-4 text-left font-medium">Feature</th>
										<th className="py-4 px-4 text-left font-medium">Free</th>
										<th className="py-4 px-4 text-left font-medium">Pro</th>
										<th className="py-4 px-4 text-left font-medium">
											Enterprise
										</th>
									</tr>
								</thead>
								<tbody className="text-gray-700">
									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Core Features
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Users</td>
										<td className="py-3 px-4">Up to 5</td>
										<td className="py-3 px-4">Up to 25</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Workspaces</td>
										<td className="py-3 px-4">1</td>
										<td className="py-3 px-4">5</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Channels per workspace</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Storage</td>
										<td className="py-3 px-4">5 GB</td>
										<td className="py-3 px-4">25 GB</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Messaging & Communication
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Real-time messaging</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Rich text formatting</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Threaded conversations</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Emoji reactions</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Direct messages</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">File sharing</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Message search</td>
										<td className="py-3 px-4">Limited</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">@mentions</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Task Management
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Tasks & projects</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Task categories & tags</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Priority levels</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Due dates & reminders</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Convert messages to tasks</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Boards (Kanban)
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Kanban boards</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Custom lists & cards</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Card assignments</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Card comments & activity</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Labels & priorities</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Subtasks & dependencies</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Notes & Documentation
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Rich text notes</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Note tags</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Cover images & icons</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Real-time collaboration</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Canvas & Whiteboard
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Collaborative canvas</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Real-time drawing</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Calendar & Scheduling
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Unified calendar view</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Event creation from messages</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Task & board card integration</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											AI Assistant
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">AI chatbot</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">Advanced</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Workspace search & Q&A</td>
										<td className="py-3 px-4">Limited</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Channel summaries</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Integration workflows</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Integrations
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">GitHub</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Gmail</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Slack</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Linear</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Notion</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">ClickUp</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Dashboard & Analytics
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Personal dashboard</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Customizable widgets</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Activity tracking</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Weekly digest emails</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Security & Administration
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Role-based permissions</td>
										<td className="py-3 px-4">Basic (Owner, Admin, Member)</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">Advanced</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Workspace invite codes</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Activity audit logs</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">SSO & SAML</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Data export</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Support
										</td>
									</tr>
									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={4}>
											Support
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Community support</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Priority support</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr>
										<td className="py-3 px-4">Dedicated support</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
									</tr>
								</tbody>
							</table>
						</div>
					</div>
				</div>
			</section>

			{/* CTA Section */}
			<CTASection />

			<Footer />
		</div>
	);
};

export default PricingPage;
