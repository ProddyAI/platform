import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { PropsWithChildren } from "react";
import { Poppins } from "next/font/google";
import { ConvexClientProvider } from "@/config/convex-client-provider";
import { JotaiProvider } from "@/components/jotai-provider";
import { ModalProvider } from "@/components/modal-provider";
import { Toaster } from "@/components/ui/sonner";
import { TidioChat } from "@/components/tidio-chat";
import { Formbricks } from "@/components/formbricks";
import { UsetifulProvider } from "@/components/usetiful-provider";
import { ClarityTracking } from "@/components/clarity-tracking";
import { ApolloTracking } from "@/components/apollo-tracking";
import { DevServiceWorkerCleanup } from "@/components/dev-service-worker-cleanup";
import { ThemeInitScript } from "@/components/theme-init-script";
import { siteConfig } from "@/config";

import "./globals.css";

const poppins = Poppins({
  weight: ['300', '400', '500', '600', '700'],
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-poppins',
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
  title: "Proddy - Your Team's Second Brain",
  description:
    "A vibrant team collaboration platform with real-time messaging, rich text editing, and emoji support.",
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
          <ThemeInitScript />
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <link rel="apple-touch-icon" href="/logo-nobg.png" />
        </head>
        <body className={`${poppins.variable} antialiased font-sans`}>
          <ConvexClientProvider>
            <JotaiProvider>
              <UsetifulProvider>
                <DevServiceWorkerCleanup />
                <Toaster theme="light" richColors closeButton />
                <ModalProvider />
                <TidioChat />
                <Formbricks />
                <ClarityTracking />
                <ApolloTracking />
                {children}
              </UsetifulProvider>
            </JotaiProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
};

export default RootLayout;
