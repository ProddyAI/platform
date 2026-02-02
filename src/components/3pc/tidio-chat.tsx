"use client";

import { useQuery } from "convex/react";
import { usePathname } from "next/navigation";
import Script from "next/script";
import { useEffect } from "react";
import { api } from "@/../convex/_generated/api";

// Add TypeScript declaration for Tidio Chat API
declare global {
	interface Window {
		tidioChatApi?: {
			hide: () => void;
			show: () => void;
			open: () => void;
			on: (event: string, callback: () => void) => void;
			isOpen: () => boolean;
			setVisitorData: (data: Record<string, any>) => void;
			addVisitorTags: (tags: string[]) => void;
		};
		tidioIdentify?: {
			distinct_id?: string;
			email?: string;
			name?: string;
			phone?: string;
		};
	}
}

// List of public routes where Tidio should be visible by default
const PUBLIC_ROUTES = [
	"/home",
	"/about",
	"/contact",
	"/features",
	"/pricing",
	"/why-proddy",
	"/assistant",
	"/mockup",
	"/auth/signup",
	"/auth/signin",
	"/auth",
	"/", // Root path
];

export const TidioChat = () => {
	const pathname = usePathname();

	// Get current user from Convex
	const currentUser = useQuery(api.users.current);

	useEffect(() => {
		// Set up user identification for Tidio
		if (currentUser?._id) {
			// Define the tidioIdentify object directly on the document
			// This must be done before the Tidio script loads
			window.tidioIdentify = {
				distinct_id: currentUser._id,
				email: currentUser.email || "",
				name: currentUser.name || "",
			};

			// Also set up a handler for when Tidio is loaded to update visitor data
			const handleTidioLoaded = () => {
				if (window.tidioChatApi) {
					// Set additional visitor data after Tidio is loaded
					window.tidioChatApi.setVisitorData({
						email: currentUser.email || "",
						name: currentUser.name || "",
						userId: currentUser._id,
					});

					// Add tags if needed
					if (currentUser.name) {
						window.tidioChatApi.addVisitorTags(["logged-in-user"]);
					}
				}
			};

			// Check if Tidio is already loaded
			if (window.tidioChatApi) {
				handleTidioLoaded();
			} else {
				// If not loaded yet, add event listener for when it's ready
				document.addEventListener("tidioChat-ready", handleTidioLoaded);
			}

			// Cleanup function
			return () => {
				document.removeEventListener("tidioChat-ready", handleTidioLoaded);
			};
		}
	}, [currentUser]);

	useEffect(() => {
		// Function to initialize Tidio when it's ready
		const handleTidioChatApiReady = () => {
			// Check if current path is in the list of public routes
			const isPublicRoute = PUBLIC_ROUTES.some(
				(route) => pathname === route || pathname.startsWith(`${route}/`)
			);

			// Hide chat widget on non-public routes
			if (!isPublicRoute && window.tidioChatApi) {
				window.tidioChatApi.hide();
			}
		};

		// Check if Tidio is already loaded
		if (window.tidioChatApi) {
			window.tidioChatApi.on("ready", handleTidioChatApiReady);
		} else {
			// If not loaded yet, add event listener for when it's ready
			document.addEventListener("tidioChat-ready", handleTidioChatApiReady);
		}

		// Cleanup function
		return () => {
			document.removeEventListener("tidioChat-ready", handleTidioChatApiReady);
		};
	}, [pathname]);

	// Use Next.js public environment variable for Tidio key
	const tidioKey = process.env.NEXT_PUBLIC_TIDIO_PUBLIC_KEY;

	return (
		<>
			{/* Set up tidioIdentify before loading the Tidio script */}
			{currentUser?._id && (
				<Script
					dangerouslySetInnerHTML={{
						__html: `
              // Define visitor identification data
              document.tidioIdentify = {
                distinct_id: "${currentUser._id}",
                email: "${currentUser.email || ""}",
                name: "${currentUser.name || ""}"
              };

              // Create a function to handle when Tidio is ready
              function onTidioReady() {
                if (window.tidioChatApi) {
                  // Set additional visitor data
                  window.tidioChatApi.setVisitorData({
                    email: "${currentUser.email || ""}",
                    name: "${currentUser.name || ""}",
                    userId: "${currentUser._id}"
                  });

                  // Add tags for better visitor categorization
                  window.tidioChatApi.addVisitorTags(['logged-in-user']);
                }
              }

              // Add event listener for when Tidio is ready
              document.addEventListener("tidioChat-ready", onTidioReady);
            `,
					}}
					id="tidio-identify"
					strategy="afterInteractive"
				/>
			)}

			{/* Load Tidio script */}
			{tidioKey && (
				<Script
					id="tidio-chat"
					src={`//code.tidio.co/${tidioKey}.js`}
					strategy="lazyOnload"
				/>
			)}

			{/* Add custom CSS for widget spacing */}
			<style global jsx>{`
        #tidio-chat-iframe,
        #tidio-chat {
          bottom: 20px !important;
          right: 20px !important;
        }
      `}</style>
		</>
	);
};
