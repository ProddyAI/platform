"use client";

import { motion } from "framer-motion";
import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { Accordion, AccordionItem } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
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
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
							className="inline-flex items-center px-3 py-1 text-xs font-medium rounded-full bg-primary/10 text-primary mb-4"
						>
							BETA PRICING
						</motion.div>
						<motion.h1
							className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Free During <span className="text-primary">Beta</span>
						</motion.h1>
						<motion.p
							className="text-xl text-gray-600 max-w-3xl mx-auto mb-10"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							Proddy is free for students and startups during our beta. Get
							started on your projects with zero learning curve.
						</motion.p>
					</div>
				</div>
			</section>

			{/* Pricing Section */}
			<section className="py-16 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 md:grid-cols-3 gap-8">
						{/* Free Plan */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.3 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
						>
							<Badge
								variant="outline"
								className="absolute top-4 right-4 bg-blue-50 text-blue-700 border-blue-200"
							>
								Current
							</Badge>
							<h3 className="text-lg font-semibold mb-2">Free</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$0</span>
								<span className="text-gray-500 ml-2">/month</span>
							</div>
							<p className="text-gray-600 mb-6">
								Full access to all features during our beta period. No credit
								card required.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited workspaces</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited members</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">All modules included</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">AI-powered features</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Community support</span>
								</li>
							</ul>
							<Link href="/signup">
								<Button className="w-full">
									Get Started <ArrowRight className="ml-2 h-4 w-4" />
								</Button>
							</Link>
						</motion.div>

						{/* Future Basic Plan */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-gray-100 relative"
						>
							<Badge
								variant="outline"
								className="absolute top-4 right-4 bg-gray-50 text-gray-500 border-gray-200"
							>
								Coming Soon
							</Badge>
							<h3 className="text-lg font-semibold mb-2">Basic</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$8</span>
								<span className="text-gray-500 ml-2">/user/month</span>
							</div>
							<p className="text-gray-600 mb-6">
								Essential tools for small teams to collaborate effectively.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Up to 3 workspaces</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Up to 10 members per workspace
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Core modules included</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Basic AI features</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Email support</span>
								</li>
							</ul>
							<Button disabled variant="outline" className="w-full">
								Coming Soon
							</Button>
						</motion.div>

						{/* Future Pro Plan */}
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.5 }}
							className="bg-white rounded-xl shadow-sm p-8 border border-primary/20 relative ring-1 ring-primary/20"
						>
							<Badge className="absolute top-4 right-4">Coming Soon</Badge>
							<h3 className="text-lg font-semibold mb-2">Pro</h3>
							<div className="mb-6">
								<span className="text-4xl font-bold">$15</span>
								<span className="text-gray-500 ml-2">/user/month</span>
							</div>
							<p className="text-gray-600 mb-6">
								Advanced features for growing teams with complex needs.
							</p>
							<ul className="space-y-3 mb-8">
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited workspaces</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Unlimited members</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">All modules included</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">
										Advanced AI capabilities
									</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Priority support</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Advanced analytics</span>
								</li>
								<li className="flex items-start">
									<Check className="h-5 w-5 text-green-500 mr-2 flex-shrink-0 mt-0.5" />
									<span className="text-gray-700">Custom integrations</span>
								</li>
							</ul>
							<Button disabled variant="outline" className="w-full">
								Coming Soon
							</Button>
						</motion.div>
					</div>
				</div>
			</section>

			{/* FAQ Section */}
			<section className="py-20 bg-gradient-to-b from-white to-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<motion.div
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
							className="inline-flex items-center px-3 py-1 text-sm font-medium rounded-full bg-secondary/10 text-secondary mb-4"
						>
							GOT QUESTIONS?
						</motion.div>
						<motion.h2
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.1 }}
							className="text-3xl md:text-4xl font-bold mb-4 text-gray-900"
						>
							Frequently Asked Questions
						</motion.h2>
						<motion.p
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.2 }}
							className="text-lg text-gray-600 max-w-3xl mx-auto"
						>
							Everything you need to know about Proddy's pricing, features, and
							future plans.
						</motion.p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative">
						{/* Decorative elements */}
						<div className="absolute -top-10 -left-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl opacity-70 z-0" />
						<div className="absolute -bottom-10 -right-10 w-40 h-40 bg-secondary/5 rounded-full blur-3xl opacity-70 z-0" />

						{/* Left Column */}
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.5, delay: 0.3 }}
							className="space-y-6 relative z-10"
						>
							<Accordion className="space-y-6">
								<AccordionItem title="How long will Proddy be free?">
									<p>
										Proddy will remain completely free during our beta period.
										We'll provide at least 30 days notice before introducing
										paid plans. During this time, you'll have full access to all
										features including our AI-powered daily recaps, smart
										summarization, and collaborative canvas.
									</p>
								</AccordionItem>

								<AccordionItem title="Will my data be migrated when paid plans launch?">
									<p>
										Yes, all your data will be automatically migrated when we
										introduce paid plans. You'll have the option to choose which
										plan works best for your team. We're committed to making
										this transition as smooth as possible, with no data loss or
										interruption to your workflows.
									</p>
								</AccordionItem>

								<AccordionItem title="What happens if I exceed plan limits?">
									<p>
										During the beta, there are no usage limits. When paid plans
										launch, if you approach your plan's limits, you'll receive
										notifications with options to upgrade. We won't suddenly cut
										off access to your data or disrupt your team's work. You'll
										always have time to make an informed decision about
										upgrading.
									</p>
								</AccordionItem>
							</Accordion>
						</motion.div>

						{/* Right Column */}
						<motion.div
							initial={{ opacity: 0, x: 20 }}
							animate={{ opacity: 1, x: 0 }}
							transition={{ duration: 0.5, delay: 0.4 }}
							className="space-y-6 relative z-10"
						>
							<Accordion className="space-y-6">
								<AccordionItem title="Will there be a free plan after beta?">
									<p>
										Yes, we plan to offer a free tier with core functionality
										even after we launch paid plans. Beta users will receive
										special benefits when transitioning, including extended
										access to premium features and priority support. We're
										committed to ensuring our early supporters are rewarded for
										their trust in us.
									</p>
								</AccordionItem>

								<AccordionItem title="Are there any limitations during the beta?">
									<p>
										While we're in beta, you have access to all features without
										limitations. However, some modules and features may still be
										under development. Our canvas feature, daily recaps, and
										smart summarization are fully functional, while we continue
										to enhance other aspects of the platform based on user
										feedback.
									</p>
								</AccordionItem>

								<AccordionItem title="Do you offer discounts for nonprofits or education?">
									<p>
										Yes! We're committed to supporting nonprofits, educational
										institutions, and open-source projects. Once paid plans
										launch, we'll offer significant discounts for qualifying
										organizations. Contact our team at{" "}
										<span className="text-primary font-medium">
											support@proddy.tech
										</span>{" "}
										to learn more about our discount programs and how to apply.
									</p>
								</AccordionItem>
							</Accordion>
						</motion.div>
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
