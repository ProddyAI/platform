"use client";

import { motion } from "framer-motion";
import { Clock, Heart, Lightbulb, Target, Users, Zap } from "lucide-react";
import Image from "next/image";

import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const AboutPage = () => {
	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<section className="py-20 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<motion.h1
							className="text-4xl md:text-5xl lg:text-6xl font-bold text-gray-900 mb-6"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5 }}
						>
							Our <span className="text-primary">Mission</span> & Story
						</motion.h1>
						<motion.p
							className="text-xl text-gray-600 max-w-3xl mx-auto mb-10"
							initial={{ opacity: 0, y: 20 }}
							animate={{ opacity: 1, y: 0 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							We're building the future of team productivity with AI-powered
							tools that help teams work smarter, not harder.
						</motion.p>
					</div>
				</div>
			</section>

			{/* Our Story Section */}
			<section className="py-16 bg-gray-50">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
						<motion.div
							initial={{ opacity: 0, x: -20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
						>
							<h2 className="text-3xl font-bold mb-6">Our Story</h2>
							<div className="space-y-4 text-gray-700">
								<p>
									Proddy was born in Bengaluru, India in 2023 out of frustration
									with fragmented productivity tools that didn't work well
									together. Our founders experienced firsthand how teams waste
									countless hours switching between different applications,
									losing context, and struggling to keep information organized.
								</p>
								<p>
									We set out to build a unified platform that brings together
									all the essential tools teams need—messaging, tasks,
									calendars, boards, and more—into one seamless experience. But
									we didn't just want to create another productivity suite; we
									wanted to reimagine how teams work together.
								</p>
								<p>
									By integrating AI throughout the platform, we've created a
									system that not only organizes your work but actively helps
									you get it done faster and better. Proddy learns from your
									team's patterns, automates repetitive tasks, and provides
									insights that help you make better decisions.
								</p>
								<p>
									Today, Proddy is used by teams around the world who share our
									vision for a more productive, less stressful way of working
									together.
								</p>
							</div>
						</motion.div>
						<motion.div
							className="relative h-[400px] rounded-xl overflow-hidden shadow-lg"
							initial={{ opacity: 0, x: 20 }}
							whileInView={{ opacity: 1, x: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
						>
							<Image
								src="/about-team.jpg"
								alt="Proddy Team"
								fill
								className="object-cover"
							/>
						</motion.div>
					</div>
				</div>
			</section>

			{/* Our Values Section */}
			<section className="py-16 bg-white">
				<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center mb-16">
						<h2 className="text-3xl font-bold mb-4">Our Values</h2>
						<p className="text-xl text-gray-600 max-w-3xl mx-auto">
							The principles that guide everything we do at Proddy.
						</p>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
						{/* Value 1 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Users className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Team First</h3>
							<p className="text-gray-700">
								We believe that great products are built by great teams. We
								prioritize collaboration, open communication, and mutual respect
								in everything we do.
							</p>
						</motion.div>

						{/* Value 2 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Lightbulb className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Innovation</h3>
							<p className="text-gray-700">
								We're not satisfied with the status quo. We constantly push
								boundaries to find better ways to help teams work together more
								effectively.
							</p>
						</motion.div>

						{/* Value 3 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: 0.2 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Target className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Customer Focus</h3>
							<p className="text-gray-700">
								Our customers' success is our success. We listen carefully to
								feedback and continuously improve our product to meet their
								evolving needs.
							</p>
						</motion.div>

						{/* Value 4 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: 0.3 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Clock className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Time Respect</h3>
							<p className="text-gray-700">
								We believe time is precious. Every feature we build aims to save
								our users time and help them focus on what truly matters.
							</p>
						</motion.div>

						{/* Value 5 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: 0.4 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Zap className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Simplicity</h3>
							<p className="text-gray-700">
								We strive for elegant simplicity in our design and
								functionality. Complex problems deserve simple, intuitive
								solutions.
							</p>
						</motion.div>

						{/* Value 6 */}
						<motion.div
							className="bg-gray-50 rounded-xl p-8 border border-gray-100"
							initial={{ opacity: 0, y: 20 }}
							whileInView={{ opacity: 1, y: 0 }}
							viewport={{ once: true }}
							transition={{ duration: 0.5, delay: 0.5 }}
						>
							<div className="bg-primary/10 p-3 rounded-full w-fit mb-6">
								<Heart className="text-primary h-6 w-6" />
							</div>
							<h3 className="text-xl font-semibold mb-4">Passion</h3>
							<p className="text-gray-700">
								We're passionate about creating tools that people love to use.
								This passion drives us to go the extra mile in everything we do.
							</p>
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

export default AboutPage;
