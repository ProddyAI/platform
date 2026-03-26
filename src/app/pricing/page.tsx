"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Button } from "@/components/ui/button";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const PricingPage = () => {
	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<HeroSection />

			{/* Pricing Section */}
			<section className="py-16 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-3 gap-8">
						{/* Free Plan */}
						<FreePlan />

						{/* Pro Plan */}
						<StarterPlan />

						{/* Enterprise Plan */}
						<EnterprisePlan />
					</div>
				</div>
			</section>

			{/*Comparison Table */}
			<ComparisonTable />

			{/* CTA Section */}
			<CTASection />

			<Footer />
		</div>
	);
};

export default PricingPage;

function HeroSection() {
	return (
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
						Free for everyone during <span className="text-primary">beta</span>
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
	);
}

function ComparisonTable() {
	const pricingData = [
		{
			category: "AI Usage Limits (Monthly)",
			features: [
				{
					name: "AI chat requests",
					free: "50",
					pro: "1,000",
					enterprise: "Unlimited",
				},
				{
					name: "AI diagram generations",
					free: "10",
					pro: "500",
					enterprise: "Unlimited",
				},
				{
					name: "AI summary requests",
					free: "10",
					pro: "500",
					enterprise: "Unlimited",
				},
			],
		},
		{
			category: "Communication Limits (Monthly)",
			features: [
				{
					name: "Messages sent",
					free: "1,000",
					pro: "50,000",
					enterprise: "Unlimited",
				},
				{
					name: "Channels created",
					free: "5",
					pro: "50",
					enterprise: "Unlimited",
				},
			],
		},
		{
			category: "Work Management Limits (Monthly)",
			features: [
				{
					name: "Tasks created",
					free: "50",
					pro: "1,000",
					enterprise: "Unlimited",
				},
				{
					name: "Board cards created",
					free: "2",
					pro: "20",
					enterprise: "Unlimited",
				},
				{
					name: "Notes created",
					free: "20",
					pro: "500",
					enterprise: "Unlimited",
				},
			],
		},
		{
			category: "Billing & Access",
			features: [
				{
					name: "Price per user",
					free: "$0/month",
					pro: "$5/month",
					enterprise: "Custom pricing",
				},
				{
					name: "Customer portal access",
					free: "No",
					pro: "Yes",
					enterprise: "Yes",
				},
				{
					name: "Seat-based billing",
					free: "No",
					pro: "Yes",
					enterprise: "Yes",
				},
				{
					name: "Subscription management",
					free: "No",
					pro: "Self-service",
					enterprise: "Dedicated support",
				},
			],
		},
		{
			category: "Support",
			features: [
				{
					name: "Customer support",
					free: "Community",
					pro: "Email priority",
					enterprise: "Dedicated SLA",
				},
				{
					name: "Webhook-driven updates",
					free: "No",
					pro: "Yes",
					enterprise: "Yes",
				},
				{
					name: "Plan enforcement",
					free: "✓",
					pro: "✓",
					enterprise: "✓",
				},
			],
		},
	];
	return (
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
								{pricingData.map((section) => (
									<Fragment key={section.category}>
										{/* Category header row */}
										<tr className="bg-gray-50">
											<td className="py-3 px-4 font-semibold" colSpan={4}>
												{section.category}
											</td>
										</tr>

										{/* Feature rows */}
										{section.features.map((feature, featureIndex) => (
											<tr
												className="border-b border-gray-100"
												key={feature.name}
											>
												<td className="py-3 px-4">{feature.name}</td>
												<td className="py-3 px-4">{feature.free}</td>
												<td className="py-3 px-4">{feature.pro}</td>
												<td className="py-3 px-4">{feature.enterprise}</td>
											</tr>
										))}
									</Fragment>
								))}
							</tbody>
						</table>
					</div>
				</div>
			</div>
		</section>
	);
}

function FreePlan() {
	return (
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
				Core tasks, notes, and messaging for individuals and small teams.
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
					<span className="text-gray-700">Basic AI summaries (5 / month)</span>
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
	);
}

function StarterPlan() {
	return (
		<motion.div
			animate={{ opacity: 1, y: 0 }}
			className="bg-white rounded-xl shadow-sm p-8 border border-primary/20 relative ring-1 ring-primary/20"
			initial={{ opacity: 0, y: 20 }}
			transition={{ duration: 0.5, delay: 0.4 }}
		>
			<h3 className="text-lg font-semibold mb-2">Pro</h3>
			<div className="mb-6">
				<span className="text-4xl font-bold">$5</span>
				<span className="text-gray-500 ml-2">/user/month</span>
			</div>
			<p className="text-gray-600 mb-6">
				Everything in Free, plus higher limits and AI access for growing teams.
			</p>
			<ul className="space-y-3 mb-8">
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">1,000 AI chat requests / month</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">500 AI summaries & diagrams / month</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">50,000 messages / month</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">1,000 tasks & 500 notes / month</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">50 channels & 20 boards / month</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">Priority email support</span>
				</li>
			</ul>
			<Button className="w-full" disabled variant="outline">
				Available after beta
			</Button>
		</motion.div>
	);
}

function EnterprisePlan() {
	return (
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
					<span className="text-gray-700">Unlimited teams & workspaces</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">SCIM & SAML SSO</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">Data residency & custom SLAs</span>
				</li>
				<li className="flex items-start">
					<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
					<span className="text-gray-700">Dedicated account management</span>
				</li>
			</ul>
			<Link href="/contact">
				<Button className="w-full" variant="outline">
					Contact Sales
				</Button>
			</Link>
		</motion.div>
	);
}
