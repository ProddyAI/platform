"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { showTidioChat } from "@/lib/client/tidio-helpers";

export const Footer = () => {
	const statusUrl = process.env.NEXT_PUBLIC_STATUS_URL;
	const feedbackUrl = process.env.NEXT_PUBLIC_FEEDBACK_URL;
	const docsUrl = process.env.NEXT_PUBLIC_DOCS_URL;
	const careersUrl = process.env.NEXT_PUBLIC_CAREERS_URL;
	const fromEmail = process.env.NEXT_PUBLIC_RESEND_FROM_EMAIL;
	const hasStatusUrl = Boolean(statusUrl && statusUrl !== "#");
	const hasFeedbackUrl = Boolean(feedbackUrl && feedbackUrl !== "#");
	const hasDocsUrl = Boolean(docsUrl && docsUrl !== "#");
	const hasCareersUrl = Boolean(careersUrl && careersUrl !== "#");

	return (
		<footer className="bg-background border-t border-border pt-16 pb-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex flex-col md:flex-row justify-between">
					{/* Logo and description */}
					<div className="md:w-1/3 mb-8 md:mb-0 md:pr-8">
						<Link className="flex items-center gap-2 mb-4 group" href="/home">
							<div className="relative size-8 overflow-hidden">
								<Image
									alt="Proddy Logo"
									className="object-contain"
									fill
									src="/logo-nobg.png"
								/>
							</div>
							<span className="text-xl font-bold text-foreground">Proddy</span>
						</Link>
						<p className="text-sm text-muted-foreground mb-6 max-w-md">
							The modular productivity suite for modern teams, with AI built in
							where it saves real time.
						</p>
						<p className="text-sm text-muted-foreground mb-6">
							Made with ❤️ in Bengaluru
						</p>
					</div>

					<div className="md:w-2/3 flex flex-col md:flex-row justify-between">
						{/* Product links */}
						<div className="mb-8 md:mb-0 md:w-1/3">
							<h3 className="text-sm font-semibold text-foreground tracking-wider uppercase mb-4">
								Product
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/features"
									>
										Features
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/why-proddy"
									>
										Why Proddy?
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/pricing"
									>
										Pricing
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/assistant"
									>
										Assistant
									</Link>
								</li>
							</ul>
						</div>

						{/* Company links */}
						<div className="mb-8 md:mb-0 md:w-1/3">
							<h3 className="text-sm font-semibold text-foreground tracking-wider uppercase mb-4">
								Company
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/about"
									>
										About Us
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-muted-foreground hover:text-primary transition-colors"
										href="/contact"
									>
										Contact
									</Link>
								</li>
								<li>
									<button
										className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
										onClick={() => showTidioChat()}
										type="button"
									>
										Support
									</button>
								</li>
							</ul>
						</div>

						{/* Resources links */}
						<div className="md:w-1/3">
							<h3 className="text-sm font-semibold text-foreground tracking-wider uppercase mb-4">
								Resources
							</h3>
							<ul className="space-y-3">
								{hasStatusUrl && (
									<li>
										<Link
											className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
											href={statusUrl || "#"}
											rel="noopener noreferrer"
											target="_blank"
										>
											Status <ExternalLink className="size-3" />
										</Link>
									</li>
								)}
								{hasFeedbackUrl && (
									<li>
										<Link
											className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
											href={feedbackUrl || "#"}
											rel="noopener noreferrer"
											target="_blank"
										>
											Feedback <ExternalLink className="size-3" />
										</Link>
									</li>
								)}
								{hasDocsUrl && (
									<li>
										<a
											className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
											href={docsUrl || "#"}
											rel="noopener noreferrer"
											target="_blank"
										>
											Help <ExternalLink className="size-3" />
										</a>
									</li>
								)}
								{hasCareersUrl && (
									<li>
										<a
											className="text-sm text-muted-foreground hover:text-primary transition-colors inline-flex items-center gap-1"
											href={careersUrl || "#"}
											rel="noopener noreferrer"
											target="_blank"
										>
											Careers <ExternalLink className="size-3" />
										</a>
									</li>
								)}
							</ul>
						</div>
					</div>
				</div>

				{/* Bottom section with legal links */}
				<div className="mt-12 pt-8 border-t border-border">
					<div className="flex flex-col md:flex-row justify-between items-center">
						<p className="text-sm text-muted-foreground">
							© {new Date().getFullYear()} Proddy. All rights reserved.
						</p>
						<div className="flex flex-wrap gap-6 mt-4 md:mt-0">
							{fromEmail && (
								<a
									className="text-sm text-muted-foreground hover:text-primary transition-colors"
									href={`mailto:${fromEmail}`}
								>
									{fromEmail}
								</a>
							)}
							<Link
								className="text-sm text-muted-foreground hover:text-primary transition-colors"
								href="/privacy"
							>
								Privacy Policy
							</Link>
							<Link
								className="text-sm text-muted-foreground hover:text-primary transition-colors"
								href="/terms"
							>
								Terms of Service
							</Link>
						</div>
					</div>
				</div>
			</div>
		</footer>
	);
};
