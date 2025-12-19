'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import Script from 'next/script';
import { useQuery } from 'convex/react';
import { api } from '@/../convex/_generated/api';

// Add TypeScript declaration for Zoho SalesIQ API
declare global {
  interface Window {
    $zoho?: {
      salesiq?: {
        ready: (callback: () => void) => void;
        floatwindow?: {
          visible: (mode: 'show' | 'hide') => void;
        };
        floatbutton?: {
          visible: (mode: 'show' | 'hide') => void;
        };
        visitor?: {
          name: (name: string) => void;
          email: (email: string) => void;
          info: (data: Record<string, any>) => void;
        };
      };
    };
  }
}

// List of public routes where Zoho SalesIQ should be visible by default
const PUBLIC_ROUTES = [
  '/home',
  '/about',
  '/contact',
  '/features',
  '/pricing',
  '/why-proddy',
  '/assistant',
  '/mockup',
  '/signup',
  '/signin',
  '/auth',
  '/' // Root path
];

export const ZohoSalesIQ = () => {
  const pathname = usePathname();

  // Get current user from Convex
  const currentUser = useQuery(api.users.current);

  useEffect(() => {
    // Set up user identification for Zoho SalesIQ
    if (currentUser && currentUser._id) {
      // Initialize Zoho SalesIQ
      window.$zoho = window.$zoho || {};
      window.$zoho.salesiq = window.$zoho.salesiq || { ready: function () { } };

      // Set up a handler for when Zoho SalesIQ is loaded
      const handleZohoLoaded = () => {
        if (window.$zoho?.salesiq?.visitor) {
          // Set visitor data
          if (currentUser.name) {
            window.$zoho.salesiq.visitor.name(currentUser.name);
          }
          if (currentUser.email) {
            window.$zoho.salesiq.visitor.email(currentUser.email);
          }
          // Set additional custom info
          window.$zoho.salesiq.visitor.info({
            userId: currentUser._id,
            userType: 'logged-in-user'
          });
        }
      };

      // Check if Zoho SalesIQ is already loaded
      if (window.$zoho?.salesiq?.ready) {
        window.$zoho.salesiq.ready(handleZohoLoaded);
      }
    }
  }, [currentUser]);

  useEffect(() => {
    // Function to control visibility based on route
    const handleVisibility = () => {
      // Check if current path is in the list of public routes
      const isPublicRoute = PUBLIC_ROUTES.some(route =>
        pathname === route || pathname.startsWith(`${route}/`)
      );

      // Control visibility based on route
      if (window.$zoho?.salesiq?.ready) {
        window.$zoho.salesiq.ready(() => {
          if (!isPublicRoute && window.$zoho?.salesiq?.floatbutton) {
            // Hide chat widget on non-public routes
            window.$zoho.salesiq.floatbutton.visible('hide');
          } else if (window.$zoho?.salesiq?.floatbutton) {
            // Show chat widget on public routes
            window.$zoho.salesiq.floatbutton.visible('show');
          }
        });
      }
    };

    // Call visibility handler
    handleVisibility();
  }, [pathname]);

  // Get widget code from environment variable
  const widgetCode = process.env.NEXT_PUBLIC_ZOHO_SALESIQ_WIDGET_CODE;

  return (
    <>
      {/* Initialize Zoho SalesIQ */}
      <Script
        id="zoho-salesiq-init"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            window.$zoho = window.$zoho || {};
            $zoho.salesiq = $zoho.salesiq || {ready:function(){}};
          `
        }}
      />

      {/* Set up user identification before loading the Zoho script */}
      {currentUser && currentUser._id && (
        <Script
          id="zoho-identify"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              // Set visitor data when Zoho SalesIQ is ready
              $zoho.salesiq.ready = function() {
                if (window.$zoho && window.$zoho.salesiq && window.$zoho.salesiq.visitor) {
                  ${currentUser.name ? `$zoho.salesiq.visitor.name("${currentUser.name}");` : ''}
                  ${currentUser.email ? `$zoho.salesiq.visitor.email("${currentUser.email}");` : ''}
                  $zoho.salesiq.visitor.info({
                    userId: "${currentUser._id}",
                    userType: "logged-in-user"
                  });
                }
              };
            `
          }}
        />
      )}

      {/* Load Zoho SalesIQ script */}
      {widgetCode && (
        <Script
          id="zsiqscript"
          src={`https://salesiq.zohopublic.in/widget?wc=${widgetCode}`}
          strategy="lazyOnload"
          defer
        />
      )}

      {/* Add custom CSS for widget spacing */}
      <style jsx global>{`
        /* Float button spacing */
        #zsiq_float {
          bottom: 20px !important;
          right: 20px !important;
        }
        
        /* Chat window/widget spacing - ensure close button is visible */
        #siqiframe {
          bottom: 20px !important;
          right: 20px !important;
          max-height: calc(100vh - 40px) !important;
          max-width: calc(100vw - 40px) !important;
        }
        
        .zsiq_floatmain,
        .zsiq_flt_rel {
          bottom: 20px !important;
          right: 20px !important;
        }
        
        /* Ensure widget doesn't overflow viewport */
        div[id*="zsiq"][style*="position: fixed"],
        div[class*="zsiq"][style*="position: fixed"] {
          max-height: calc(100vh - 40px) !important;
          max-width: calc(100vw - 40px) !important;
        }
      `}</style>
    </>
  );
};
