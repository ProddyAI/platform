import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import Script from "next/script";
import type { PropsWithChildren } from "react";
import { ApolloTracking } from "@/components/3pc/apollo-tracking";
import { Formbricks } from "@/components/3pc/formbricks";
import { GoogleAnalyticsTracking } from "@/components/3pc/google-analytics-tracking";
import { AuthenticatedOneSignalTracking } from "@/components/3pc/notifications";
import { TidioChat } from "@/components/3pc/tidio-chat";
import { UsetifulProvider } from "@/components/3pc/usetiful-provider";
import { AdBlockerProvider } from "@/components/providers/ad-blocker-provider";
import { ConvexClientProvider } from "@/components/providers/convex-client-provider";
import { JotaiProvider } from "@/components/providers/jotai-provider";
import { ModalProvider } from "@/components/providers/modal-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config";

import "./globals.css";

const inter = Inter({
	subsets: ["latin"],
	variable: "--font-sans",
	display: "swap",
});

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	viewportFit: "cover",
	themeColor: "#ffffff",
};

const metadata: Metadata = {
	...siteConfig,
	title: "Proddy - Your Smart Work Management Suite",
	description:
		"Proddy unifies canvas, meetings, messaging, notes so work moves from discussion to execution without friction.",
	manifest: "/manifest.json",
	appleWebApp: {
		capable: true,
		statusBarStyle: "default",
		title: "Proddy",
	},
	applicationName: "Proddy",
	formatDetection: {
		telephone: false,
	},
};

export function generateMetadata(): Metadata {
	return {
		...metadata,
	};
}

const RootLayout = ({ children }: Readonly<PropsWithChildren>) => {
	return (
		<ConvexAuthNextjsServerProvider>
			<html className={inter.variable} lang="en">
				<head>
					<meta content="yes" name="apple-mobile-web-app-capable" />
					<meta content="yes" name="mobile-web-app-capable" />
					<link href="/logo-nobg.png" rel="apple-touch-icon" />
				</head>
				<body className="antialiased font-sans">
					<Script id="force-light-mode" strategy="beforeInteractive">
						{`
							(function() {
								// Force light mode only on public pages (e.g. /auth/signin, /auth/signup, /home)
								if (typeof window === 'undefined') return;
								
								var publicPaths = ['/', '/home', '/about', '/contact', '/features', '/pricing', '/privacy', '/terms', '/auth', '/auth/signin', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];
								var path = window.location && window.location.pathname ? window.location.pathname : '';

								if (publicPaths.indexOf(path) !== -1 || path.indexOf('/auth/join') === 0) {
									document.documentElement.classList.remove('dark');
								}
							})();
						`}
					</Script>
					<ConvexClientProvider>
						<AdBlockerProvider>
							<JotaiProvider>
								<UsetifulProvider>
									<Toaster closeButton richColors theme="light" />
									<ModalProvider />
									<AuthenticatedOneSignalTracking />
									<TidioChat />
									<Formbricks />
									<ApolloTracking />
									<GoogleAnalyticsTracking />
									{children}
								</UsetifulProvider>
							</JotaiProvider>
						</AdBlockerProvider>
					</ConvexClientProvider>
				</body>
			</html>
		</ConvexAuthNextjsServerProvider>
	);
};

export default RootLayout;
