import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import Script from "next/script";
import type { PropsWithChildren } from "react";
import { ApolloTracking } from "@/components/3pc/apollo-tracking";
import { ClarityTracking } from "@/components/3pc/clarity-tracking";
import { Formbricks } from "@/components/3pc/formbricks";
import { AuthenticatedOneSignalTracking } from "@/components/3pc/notifications";
import { TidioChat } from "@/components/3pc/tidio-chat";
import { UsetifulProvider } from "@/components/3pc/usetiful-provider";
import { JotaiProvider } from "@/components/jotai-provider";
import { ModalProvider } from "@/components/modal-provider";
import { Toaster } from "@/components/ui/sonner";
import { siteConfig } from "@/config";
import { ConvexClientProvider } from "@/config/convex-client-provider";
import { AdBlockerProvider } from "@/lib/ad-blocker-context";

import "./globals.css";

const poppins = Poppins({
	weight: ["300", "400", "500", "600", "700"],
	subsets: ["latin"],
	display: "swap",
	variable: "--font-poppins",
});

export const viewport: Viewport = {
	width: "device-width",
	initialScale: 1,
	maximumScale: 1,
	userScalable: false,
	viewportFit: "cover",
	themeColor: "#4A0D68",
};

const metadata: Metadata = {
	...siteConfig,
	title: "Proddy - Your Smart Work Management Suite  ",
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
			<html lang="en">
				<head>
					<meta content="yes" name="apple-mobile-web-app-capable" />
					<meta content="yes" name="mobile-web-app-capable" />
					<link href="/logo-nobg.png" rel="apple-touch-icon" />
				</head>
				<body className={`${poppins.variable} antialiased font-sans`}>
					<Script id="force-light-mode" strategy="beforeInteractive">
						{`
							(function() {
								// Force light mode only on public pages (e.g. /auth/signin, /auth/signup, /home)
								if (typeof window === 'undefined') return;
								
								var publicPaths = ['/', '/home', '/auth/signin', '/auth/signup', '/auth/forgot-password', '/auth/reset-password'];
								var path = window.location && window.location.pathname ? window.location.pathname : '';
								
								if (publicPaths.indexOf(path) !== -1) {
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
									<ClarityTracking />
									<ApolloTracking />
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
