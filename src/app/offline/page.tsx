"use client";

import { RefreshCw, Wifi, WifiOff } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useDocumentTitle } from "@/hooks/use-document-title";

export default function OfflinePage() {
	useDocumentTitle("Proddy - Offline");

	// Check if we're back online and refresh the page
	useEffect(() => {
		const handleOnline = () => {
			window.location.href = "/";
		};

		window.addEventListener("online", handleOnline);
		return () => window.removeEventListener("online", handleOnline);
	}, []);

	const handleRefresh = () => {
		window.location.reload();
	};

	return (
		<div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-primary/10 to-white p-4 text-center">
			<div className="mb-8 flex items-center justify-center">
				<div className="relative h-20 w-20">
					<Image
						src="/logo-nobg.png"
						alt="Proddy Logo"
						fill
						className="object-contain"
						priority
					/>
				</div>
			</div>

			<div className="mb-6 flex items-center justify-center gap-3">
				<WifiOff className="h-8 w-8 text-primary" />
				<h1 className="text-3xl font-bold text-primary">You're Offline</h1>
			</div>

			<p className="mb-8 max-w-md text-lg text-gray-600">
				It seems you've lost your internet connection. Proddy requires an
				internet connection to work properly.
			</p>

			<div className="mb-8 flex flex-col gap-4 sm:flex-row">
				<Button onClick={handleRefresh} className="flex items-center gap-2">
					<RefreshCw className="h-4 w-4" />
					Refresh Page
				</Button>
				<Link href="/" passHref>
					<Button variant="outline" className="flex items-center gap-2">
						<Wifi className="h-4 w-4" />
						Try Again
					</Button>
				</Link>
			</div>

			<div className="mt-8 text-sm text-gray-500">
				<p>
					If you continue to see this page, please check your internet
					connection and try again.
				</p>
			</div>
		</div>
	);
}
