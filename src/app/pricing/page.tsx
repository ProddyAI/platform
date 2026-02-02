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
					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
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
								<span className="text-gray-500 ml-2">/user/month</span>
							</div>
							<p className="text-gray-600 mb-6">
								Core tasks, notes, and messaging for individuals and small
								teams.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited users</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">~5 GB total storage</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Up to 2 integrations</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Basic AI summaries (5 / month)
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">1:1 voice calls only</span>
								</li>
							</ul>
							<Link href="/auth/signup">
								<Button className="w-full">
									Get Started <ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
						</motion.div>

						{/* Starter Plan */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							<h3 className="text-lg font-semibold mb-2">Starter</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$5</span>
								<span className="text-gray-500 ml-2">/user/month</span>
								<span className="text-xs text-gray-500 ml-2">
									billed annually
								</span>
							</div>
							<p className="text-gray-600 mb-6">
								Everything in Free, plus team workspaces and more storage.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Unlimited tasks & projects
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										10–20 GB storage per user
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Up to 5–10 integrations</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Basic AI summaries (20 / month)
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Group calls up to 720p</span>
								</li>
							</ul>
							<Button className="w-full" disabled variant="outline">
								Available after beta
							</Button>
						</motion.div>

						{/* Pro Plan */}
						<motion.div
							animate={{ opacity: 1, y: 0 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-primary/20 relative ring-1 ring-primary/20"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.5 }}
						>
							<h3 className="text-lg font-semibold mb-2">Pro</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$12</span>
								<span className="text-gray-500 ml-2">/user/month</span>
								<span className="text-xs text-gray-500 ml-2">
									billed annually
								</span>
							</div>
							<p className="text-gray-600 mb-6">
								Advanced AI and security controls for growing teams.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited storage</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited integrations</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Unlimited GPT-4 summaries & Q&A
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">HD video calls (1080p)</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										SAML SSO + granular permissions
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Priority support</span>
								</li>
							</ul>
							<Button className="w-full" disabled>
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
								<span className="text-gray-500 ml-2">/quote</span>
							</div>
							<p className="text-gray-600 mb-6">
								Enterprise controls, compliance, and dedicated support.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Unlimited teams & workspaces
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">SCIM & SAML SSO</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Data residency & custom SLAs
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Dedicated account management
									</span>
								</li>
							</ul>
							<Link href="/contact">
								<Button className="w-full" variant="outline">
									Contact Sales
								</Button>
							</Link>
						</motion.div>
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
										<th className="py-4 px-4 text-left font-medium">Starter</th>
										<th className="py-4 px-4 text-left font-medium">Pro</th>
										<th className="py-4 px-4 text-left font-medium">
											Enterprise
										</th>
									</tr>
								</thead>
								<tbody className="text-gray-700">
									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Task & Messaging Integration
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Add chat messages to tasks/calendar
										</td>
										<td className="py-3 px-4">Limited</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Convert chats into tasks (with context)
										</td>
										<td className="py-3 px-4">Limited</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											AI summarization of chats/tasks
										</td>
										<td className="py-3 px-4">Basic (5 / month)</td>
										<td className="py-3 px-4">Standard (20 / month)</td>
										<td className="py-3 px-4">Unlimited (GPT-4)</td>
										<td className="py-3 px-4">Unlimited + custom</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Automated chat replies</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">Advanced</td>
										<td className="py-3 px-4">Full</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											AI-Powered Collaboration
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">AI notes & diagramming</td>
										<td className="py-3 px-4">Limited cleanup</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Contextual AI assistant (workspace Q&A)
										</td>
										<td className="py-3 px-4">Basic bots</td>
										<td className="py-3 px-4">Standard models</td>
										<td className="py-3 px-4">GPT-4 quality</td>
										<td className="py-3 px-4">Custom agents</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											AI workflows (create issues, emails, tasks)
										</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic (email only)</td>
										<td className="py-3 px-4">Advanced</td>
										<td className="py-3 px-4">Full</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Audio & Video Enhancements
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											In-app audio calls (Notes & Canvas)
										</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Video calls (max resolution)</td>
										<td className="py-3 px-4">Voice only</td>
										<td className="py-3 px-4">720p</td>
										<td className="py-3 px-4">1080p</td>
										<td className="py-3 px-4">4K+</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Meeting minutes/month</td>
										<td className="py-3 px-4">2,000</td>
										<td className="py-3 px-4">5,000</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Smart Summaries & Dashboards
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Weekly activity digest</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Custom dashboards</td>
										<td className="py-3 px-4">Up to 3</td>
										<td className="py-3 px-4">Up to 10</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Dashboard widgets</td>
										<td className="py-3 px-4">Limited</td>
										<td className="py-3 px-4">Standard</td>
										<td className="py-3 px-4">All widgets</td>
										<td className="py-3 px-4">All widgets</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Real-time activity feed</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Views & Layouts
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Kanban / Table / Calendar views
										</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Gantt (timeline) view</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Unified calendar (tasks/notes/events)
										</td>
										<td className="py-3 px-4">Tasks only</td>
										<td className="py-3 px-4">Tasks + calendar</td>
										<td className="py-3 px-4">All items</td>
										<td className="py-3 px-4">All items</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Workspace switching / invite code
										</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Canvas & Notes
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Free-form Canvas (whiteboard)</td>
										<td className="py-3 px-4">PNG export only</td>
										<td className="py-3 px-4">PNG/PDF export</td>
										<td className="py-3 px-4">PNG/PDF export</td>
										<td className="py-3 px-4">PNG/PDF export</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Real-time collaborative editing
										</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Enhanced notes editor</td>
										<td className="py-3 px-4">Spellcheck only</td>
										<td className="py-3 px-4">AI cleanup</td>
										<td className="py-3 px-4">AI + formatting</td>
										<td className="py-3 px-4">AI + formatting</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Role-based navigation</td>
										<td className="py-3 px-4">Admin + Member</td>
										<td className="py-3 px-4">Admin + Contributor</td>
										<td className="py-3 px-4">Full roles</td>
										<td className="py-3 px-4">Full roles + SSO</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Integrations & Automations
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Third-party integrations (GitHub, Jira, Slack)
										</td>
										<td className="py-3 px-4">Up to 2</td>
										<td className="py-3 px-4">Up to 5–10</td>
										<td className="py-3 px-4">Unlimited</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Zapier/Webhook automations</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic triggers</td>
										<td className="py-3 px-4">Advanced flows</td>
										<td className="py-3 px-4">All workflows</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Shared email/chat (Gmail/Slack)
										</td>
										<td className="py-3 px-4">Read-only</td>
										<td className="py-3 px-4">Standard</td>
										<td className="py-3 px-4">Full</td>
										<td className="py-3 px-4">Full + SAML SSO</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Productivity & Mobility
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">PWA / mobile access</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Offline support</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">Full</td>
										<td className="py-3 px-4">Full</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Real-time updates across devices
										</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
										<td className="py-3 px-4">✓</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Calendar & Scheduling
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Unified calendar integrations</td>
										<td className="py-3 px-4">Tasks only</td>
										<td className="py-3 px-4">Tasks + events</td>
										<td className="py-3 px-4">All tools</td>
										<td className="py-3 px-4">All tools</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Contextual AI scheduling</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic AI</td>
										<td className="py-3 px-4">Advanced AI</td>
										<td className="py-3 px-4">Enterprise AI</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Limits & Capacities
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Workspaces / Projects</td>
										<td className="py-3 px-4">1 WS, 5 projects</td>
										<td className="py-3 px-4">3 WS, 50 projects</td>
										<td className="py-3 px-4">20 WS, 200 projects</td>
										<td className="py-3 px-4">Unlimited</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Storage per workspace</td>
										<td className="py-3 px-4">5 GB</td>
										<td className="py-3 px-4">50 GB</td>
										<td className="py-3 px-4">200 GB</td>
										<td className="py-3 px-4">1 TB+</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">AI usage (monthly quota)</td>
										<td className="py-3 px-4">Basic only</td>
										<td className="py-3 px-4">Limited (GPT-4/Pro)</td>
										<td className="py-3 px-4">High (GPT-4/Pro)</td>
										<td className="py-3 px-4">Unlimited/custom</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Customer support / SLA</td>
										<td className="py-3 px-4">Community email</td>
										<td className="py-3 px-4">Email support</td>
										<td className="py-3 px-4">Priority support</td>
										<td className="py-3 px-4">Dedicated SLA</td>
									</tr>

									<tr className="bg-gray-50">
										<td className="py-3 px-4 font-semibold" colSpan={5}>
											Security & Admin (additional)
										</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">
											Role-based access & permissions
										</td>
										<td className="py-3 px-4">Basic roles</td>
										<td className="py-3 px-4">Admin + Contributor</td>
										<td className="py-3 px-4">Granular</td>
										<td className="py-3 px-4">Granular + custom policies</td>
									</tr>
									<tr className="border-b border-gray-100">
										<td className="py-3 px-4">Audit logs & exports</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Basic</td>
										<td className="py-3 px-4">Advanced</td>
										<td className="py-3 px-4">Enterprise-grade</td>
									</tr>
									<tr>
										<td className="py-3 px-4">
											Data residency & retention controls
										</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">✕</td>
										<td className="py-3 px-4">Optional</td>
										<td className="py-3 px-4">Custom</td>
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
