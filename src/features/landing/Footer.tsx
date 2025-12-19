"use client";

import Link from "next/link";
import Image from "next/image";
import { GithubIcon, Linkedin, TwitterIcon, ExternalLink } from "lucide-react";
import { showZohoChat } from "@/lib/zoho-helpers";

export const Footer = () => {
  return (
    <footer className="bg-white border-t border-gray-100 pt-16 pb-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row justify-between">
          {/* Logo and description */}
          <div className="md:w-1/3 mb-8 md:mb-0 md:pr-8">
            <Link href="/home" className="flex items-center gap-2 mb-4 group">
              <div className="relative w-8 h-8 overflow-hidden transition-transform duration-300 group-hover:scale-110">
                <Image
                  src="/logo-nobg.png"
                  alt="Proddy Logo"
                  fill
                  className="object-contain"
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
                    href="/features"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Features
                  </Link>
                </li>
                <li>
                  <Link
                    href="/why-proddy"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Why Proddy?
                  </Link>
                </li>
                <li>
                  <Link
                    href="/pricing"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Pricing
                  </Link>
                </li>
                <li>
                  <Link
                    href="/assistant"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
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
                    href="/about"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    About Us
                  </Link>
                </li>
                <li>
                  <Link
                    href="/contact"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Contact
                  </Link>
                </li>
                <li>
                  <a
                    href="https://proddy.usetiful.help/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    Documentation <ExternalLink className="size-3" />
                  </a>
                </li>
                <li>
                  <button
                    onClick={() => showZohoChat()}
                    className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
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
                    href="https://status.proddy.tech/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    Status <ExternalLink className="size-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="https://proddy.canny.io/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-gray-500 hover:text-primary transition-colors inline-flex items-center gap-1"
                  >
                    Roadmap <ExternalLink className="size-3" />
                  </Link>
                </li>
                <li>
                  <Link
                    href="/privacy"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Privacy Policy
                  </Link>
                </li>
                <li>
                  <Link
                    href="/terms"
                    className="text-sm text-gray-500 hover:text-primary transition-colors"
                  >
                    Terms of Service
                  </Link>
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
                href="mailto:support@proddy.tech"
                className="text-sm text-gray-500 hover:text-primary transition-colors"
              >
                support@proddy.tech
              </a>
              <Link
                href="/privacy"
                className="text-sm text-gray-500 hover:text-primary transition-colors"
              >
                Privacy Policy
              </Link>
              <Link
                href="/terms"
                className="text-sm text-gray-500 hover:text-primary transition-colors"
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
