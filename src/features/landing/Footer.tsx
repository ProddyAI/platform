"use client";

import { ExternalLink } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { showTidioChat } from "@/lib/client/tidio-helpers";

export const Footer = () => {
	return (
		<footer className="bg-white border-t border-gray-100 pt-16 pb-8">
			<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
				<div className="flex flex-col md:flex-row justify-between">
					{/* Logo and description */}
					<div className="md:w-1/3 mb-8 md:mb-0 md:pr-8">
						<Link className="flex items-center gap-2 mb-4 group" href="/home">
							<div className="relative w-8 h-8 overflow-hidden transition-transform duration-300 group-hover:scale-110">
								<Image
									alt="Proddy Logo"
									className="object-contain"
									fill
									src="/logo-nobg.png"
								/>
							</div>
							<span className="text-xl font-bold text-gray-900">Proddy</span>
						</Link>
						<p className="text-sm text-gray-500 mb-6 max-w-md">
							The AI-powered modular productivity suite designed for modern
							teams. Streamline your workflow with integrated tools enhanced by
							artificial intelligence.
						</p>
						<p className="text-sm text-gray-500 mb-6">
							Made with ❤️ in Bengaluru
						</p>
					</div>

					<div className="md:w-2/3 flex flex-col md:flex-row justify-between">
						{/* Product links */}
						<div className="mb-8 md:mb-0 md:w-1/3">
							<h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
								Product
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/features"
									>
										Features
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/why-proddy"
									>
										Why Proddy?
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/pricing"
									>
										Pricing
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/assistant"
									>
										Assistant
									</Link>
								</li>
							</ul>
						</div>

						{/* Company links */}
						<div className="mb-8 md:mb-0 md:w-1/3">
							<h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
								Company
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/about"
									>
										About Us
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/contact"
									>
										Contact
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors"
										href="/privacy"
									>
										Privacy Policy
									</Link>
								</li>
								<li>
									<button
										className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
										onClick={() => showTidioChat()}
									>
										Support
									</button>
								</li>
							</ul>
						</div>

						{/* Resources links */}
						<div className="md:w-1/3">
							<h3 className="text-sm font-semibold text-gray-900 tracking-wider uppercase mb-4">
								Resources
							</h3>
							<ul className="space-y-3">
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
										href={process.env.NEXT_PUBLIC_STATUS_URL!}
										rel="noopener noreferrer"
										target="_blank"
									>
										Status <ExternalLink className="size-3" />
									</Link>
								</li>
								<li>
									<Link
										className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
										href={process.env.NEXT_PUBLIC_ROADMAP_URL!}
										rel="noopener noreferrer"
										target="_blank"
									>
										Roadmap <ExternalLink className="size-3" />
									</Link>
								</li>
								<li>
									<a
										className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
										href={process.env.NEXT_PUBLIC_DOCS_URL!}
										rel="noopener noreferrer"
										target="_blank"
									>
										Help <ExternalLink className="size-3" />
									</a>
								</li>
								<li>
									<a
										className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
										href={process.env.NEXT_PUBLIC_CAREERS_URL!}
										rel="noopener noreferrer"
										target="_blank"
									>
										Careers <ExternalLink className="size-3" />
									</a>
								</li>
							</ul>
						</div>
					</div>
				</div>

				{/* Bottom section with legal links */}
				<div className="mt-12 pt-8 border-t border-gray-100">
					<div className="flex flex-col md:flex-row justify-between items-center">
						<p className="text-sm text-gray-400">
							© {new Date().getFullYear()} Proddy. All rights reserved.
						</p>
						<div className="flex flex-wrap gap-6 mt-4 md:mt-0">
							<a
								className="text-sm text-gray-500 hover:text-primary transition-colors"
								href="mailto:support@proddy.tech"
							>
								support@proddy.tech
							</a>
							<Link
								className="text-sm text-gray-500 hover:text-primary transition-colors"
								href="/privacy"
							>
								Privacy Policy
							</Link>
							<Link
								className="text-sm text-gray-500 hover:text-primary transition-colors"
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
