"use client";

import { motion } from "framer-motion";
import { CTASection } from "@/features/landing/CTASection";
import { Footer } from "@/features/landing/Footer";
import { Header } from "@/features/landing/Header";

const TermsPage = () => {
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
							Terms of Service
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

			{/* Terms of Service Content */}
			<section className="py-12 bg-gray-50">
				<div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
					<div className="bg-white p-8 rounded-xl shadow-sm">
						<div className="prose prose-lg max-w-none">
							<h2 className="text-2xl font-semibold mb-4">
								1. Agreement to Terms
							</h2>
							<p>
								By accessing or using Proddy's platform, you agree to be bound
								by these Terms of Service and all applicable laws and
								regulations. If you do not agree with any of these terms, you
								are prohibited from using or accessing this platform.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								2. Use License
							</h2>
							<p>
								Permission is granted to temporarily use Proddy's platform for
								personal, educational, or commercial purposes, subject to the
								following restrictions:
							</p>
							<ul className="list-disc pl-6 space-y-2">
								<li>
									The content on Proddy may not be modified, copied,
									distributed, or used for commercial purposes without written
									permission
								</li>
								<li>
									You may not use the platform for any illegal or unauthorized
									purpose
								</li>
								<li>
									You may not transmit any worms, viruses, or any code of a
									destructive nature
								</li>
								<li>
									You may not interfere with or disrupt the platform or servers
									or networks connected to the platform
								</li>
								<li>
									You may not attempt to gain unauthorized access to any portion
									of the platform or any other systems or networks connected to
									the platform
								</li>
							</ul>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								3. User Accounts
							</h2>
							<p>
								To access certain features of the platform, you may be required
								to register for an account. You agree to provide accurate,
								current, and complete information during the registration
								process and to update such information to keep it accurate,
								current, and complete.
							</p>
							<p className="mt-4">
								You are responsible for safeguarding the password that you use
								to access the platform and for any activities or actions under
								your password. You agree not to disclose your password to any
								third party. You must notify us immediately upon becoming aware
								of any breach of security or unauthorized use of your account.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								4. User Content
							</h2>
							<p>
								Our platform allows you to post, link, store, share and
								otherwise make available certain information, text, graphics,
								videos, or other material. You are responsible for the content
								that you post to the platform, including its legality,
								reliability, and appropriateness.
							</p>
							<p className="mt-4">
								By posting content to the platform, you grant us the right to
								use, modify, publicly perform, publicly display, reproduce, and
								distribute such content on and through the platform. You retain
								any and all of your rights to any content you submit, post, or
								display on or through the platform and you are responsible for
								protecting those rights.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								5. Subscription and Billing
							</h2>
							<p>
								Some features of the platform are provided on a subscription
								basis. You agree to pay all fees or charges to your account
								based on the fee, charges, and billing terms in effect at the
								time a fee or charge is due and payable.
							</p>
							<p className="mt-4">
								You must provide current, complete, and accurate billing and
								credit card information. By submitting such payment information,
								you automatically authorize Proddy to charge all subscription
								fees incurred through your account to any such payment
								instruments.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								6. Free Trial
							</h2>
							<p>
								Proddy may, at its sole discretion, offer a subscription with a
								free trial for a limited period of time. You may be required to
								enter your billing information to sign up for the free trial. If
								you do enter your billing information when signing up for a free
								trial, you will not be charged until the free trial has expired.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								7. Intellectual Property
							</h2>
							<p>
								The platform and its original content (excluding content
								provided by users), features, and functionality are and will
								remain the exclusive property of Proddy and its licensors. The
								platform is protected by copyright, trademark, and other laws of
								both India and foreign countries. Our trademarks and trade dress
								may not be used in connection with any product or service
								without the prior written consent of Proddy.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								8. Termination
							</h2>
							<p>
								We may terminate or suspend your account and bar access to the
								platform immediately, without prior notice or liability, under
								our sole discretion, for any reason whatsoever and without
								limitation, including but not limited to a breach of the Terms.
							</p>
							<p className="mt-4">
								If you wish to terminate your account, you may simply
								discontinue using the platform, or notify us that you wish to
								delete your account.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								9. Limitation of Liability
							</h2>
							<p>
								In no event shall Proddy, nor its directors, employees,
								partners, agents, suppliers, or affiliates, be liable for any
								indirect, incidental, special, consequential or punitive
								damages, including without limitation, loss of profits, data,
								use, goodwill, or other intangible losses, resulting from your
								access to or use of or inability to access or use the platform.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								10. Governing Law
							</h2>
							<p>
								These Terms shall be governed and construed in accordance with
								the laws of India, without regard to its conflict of law
								provisions. Our failure to enforce any right or provision of
								these Terms will not be considered a waiver of those rights.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								11. Changes to Terms
							</h2>
							<p>
								We reserve the right, at our sole discretion, to modify or
								replace these Terms at any time. If a revision is material we
								will provide at least 30 days' notice prior to any new terms
								taking effect. What constitutes a material change will be
								determined at our sole discretion.
							</p>

							<h2 className="text-2xl font-semibold mt-8 mb-4">
								12. Contact Us
							</h2>
							<p>
								If you have any questions about these Terms, please contact us
								at:
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

export default TermsPage;
