import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import type { Metadata, Viewport } from "next";
import { Poppins } from "next/font/google";
import { PropsWithChildren } from "react";
import { Analytics } from '@vercel/analytics/next';
import { ConvexClientProvider } from "@/config/convex-client-provider";
import { JotaiProvider } from "@/components/jotai-provider";
import { ModalProvider } from "@/components/modal-provider";
import { Toaster } from "@/components/ui/sonner";
import { ZohoSalesIQ } from "@/components/zoho-salesiq";
import { UsetifulProvider } from "@/components/usetiful-provider";
import { ClarityTracking } from "@/components/clarity-tracking";
import { siteConfig } from "@/config";

import "./globals.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#4A0D68",
};

export const metadata: Metadata = {
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

const RootLayout = ({ children }: Readonly<PropsWithChildren>) => {
  return (
    <ConvexAuthNextjsServerProvider>
      <html lang="en">
        <head>
          <meta name="apple-mobile-web-app-capable" content="yes" />
          <meta name="mobile-web-app-capable" content="yes" />
          <link rel="apple-touch-icon" href="/logo-nobg.png" />
        </head>
        <body className={`${poppins.className} antialiased`}>
          <ConvexClientProvider>
            <JotaiProvider>
              <UsetifulProvider>
                <Toaster theme="light" richColors closeButton />
                <ModalProvider />
                <ZohoSalesIQ />
                <ClarityTracking />

                {children}
                <Analytics />
              </UsetifulProvider>
            </JotaiProvider>
          </ConvexClientProvider>
        </body>
      </html>
    </ConvexAuthNextjsServerProvider>
  );
};

export default RootLayout;
