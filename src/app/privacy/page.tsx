"use client";

import { motion } from "framer-motion";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const PrivacyPage = () => {
	return (
		<div className="min-h-screen flex flex-col">
			<Header />

			{/* Hero Section */}
			<section className="py-16 bg-white">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="text-center">
						<motion.h1
							animate={{ opacity: 1, y: 0 }}
							className="text-4xl md:text-5xl font-bold text-gray-900 mb-6"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5 }}
						>
							Privacy Policy
						</motion.h1>
						<motion.p
							animate={{ opacity: 1, y: 0 }}
							className="text-lg text-gray-600"
							initial={{ opacity: 0, y: 20 }}
							transition={{ duration: 0.5, delay: 0.1 }}
						>
							Last updated:{" "}
							{new Date().toLocaleDateString("en-US", {
								month: "long",
								day: "numeric",
								year: "numeric",
							})}
						</motion.p>
					</div>
				</div>
			</section>

			{/* Privacy Policy Content */}
			<section className="py-12 bg-gray-50">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="bg-white p-8 rounded-xl shadow-sm">
						<div className="prose prose-lg max-w-none">
							<h2 className="text-2xl font-semibold mb-4">Introduction</h2>
							<p>
								At Proddy, we take your privacy seriously. This Privacy Policy
								explains how we collect, use, disclose, and safeguard your
								information when you use our platform. Please read this privacy
								policy carefully. If you do not agree with the terms of this
								privacy policy, please do not access the application.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								Information We Collect
							</h2>
							<p>
								We collect information that you provide directly to us when you
								register for an account, create or modify your profile, set
								preferences, or make purchases through the platform. This
								includes:
							</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>
									Personal information such as your name, email address, and
									profile picture
								</li>
								<li>Account credentials such as your password</li>
								<li>
									Billing information such as your payment method details and
									billing address
								</li>
								<li>
									Communications you send to us such as customer support
									inquiries
								</li>
								<li>
									Content you post on our platform including messages, tasks,
									and other materials
								</li>
							</ul>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								How We Use Your Information
							</h2>
							<p>We use the information we collect to:</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>Provide, maintain, and improve our services</li>
								<li>
									Process transactions and send related information including
									confirmations and invoices
								</li>
								<li>
									Send administrative messages, updates, security alerts, and
									support messages
								</li>
								<li>Respond to your comments, questions, and requests</li>
								<li>Provide customer service and technical support</li>
								<li>
									Monitor and analyze trends, usage, and activities in
									connection with our services
								</li>
								<li>
									Detect, investigate, and prevent fraudulent transactions and
									other illegal activities
								</li>
								<li>Personalize and improve your experience</li>
							</ul>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								How We Share Your Information
							</h2>
							<p>
								We may share the information we collect in various ways,
								including:
							</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>
									With vendors, consultants, and other service providers who
									need access to such information to carry out work on our
									behalf
								</li>
								<li>
									In response to a request for information if we believe
									disclosure is in accordance with any applicable law,
									regulation, or legal process
								</li>
								<li>
									If we believe your actions are inconsistent with our user
									agreements or policies, or to protect the rights, property,
									and safety of Proddy or others
								</li>
								<li>
									In connection with, or during negotiations of, any merger,
									sale of company assets, financing, or acquisition of all or a
									portion of our business by another company
								</li>
								<li>
									Between and among Proddy and our current and future parents,
									affiliates, subsidiaries, and other companies under common
									control and ownership
								</li>
								<li>With your consent or at your direction</li>
							</ul>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								Data Security
							</h2>
							<p>
								We have implemented appropriate technical and organizational
								security measures designed to protect the security of any
								personal information we process. However, despite our safeguards
								and efforts to secure your information, no electronic
								transmission over the Internet or information storage technology
								can be guaranteed to be 100% secure.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								Your Data Protection Rights
							</h2>
							<p>
								Depending on your location, you may have the following data
								protection rights:
							</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>
									The right to access, update, or delete the information we have
									on you
								</li>
								<li>
									The right of rectification - the right to have your
									information corrected if it is inaccurate or incomplete
								</li>
								<li>
									The right to object to our processing of your personal data
								</li>
								<li>
									The right of restriction - the right to request that we
									restrict the processing of your personal information
								</li>
								<li>
									The right to data portability - the right to be provided with
									a copy of your personal data in a structured, machine-readable
									format
								</li>
								<li>
									The right to withdraw consent at any time where we relied on
									your consent to process your personal information
								</li>
							</ul>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								Children's Privacy
							</h2>
							<p>
								Our service is not intended for use by children under the age of
								13. We do not knowingly collect personally identifiable
								information from children under 13. If you are a parent or
								guardian and you are aware that your child has provided us with
								personal data, please contact us.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								Changes to This Privacy Policy
							</h2>
							<p>
								We may update our Privacy Policy from time to time. We will
								notify you of any changes by posting the new Privacy Policy on
								this page and updating the "Last Updated" date at the top of
								this Privacy Policy. You are advised to review this Privacy
								Policy periodically for any changes.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">Contact Us</h2>
							<p>
								If you have any questions about this Privacy Policy, please
								contact us at:
							</p>
							<p className="mt-2">
								<strong>Email:</strong>{" "}
								<a
									className="text-primary hover:underline"
									href="mailto:support@proddy.tech"
								>
									support@proddy.tech
								</a>
							</p>
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

export default PrivacyPage;
