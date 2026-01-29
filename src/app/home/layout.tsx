"use client";

import { type PropsWithChildren, useEffect } from "react";

const HomeLayout = ({ children }: Readonly<PropsWithChildren>) => {
	useEffect(() => {
		// Force light mode
		document.documentElement.classList.remove("dark");

		// Store original setItem
		const originalSetItem = localStorage.setItem.bind(localStorage);

		// Override localStorage.setItem to prevent theme changes on /home
		localStorage.setItem = (key: string, value: string) => {
			if (key === "theme" && window.location.pathname === "/home") {
				// Prevent setting theme on /home page
				return;
			}
			return originalSetItem(key, value);
		};

		// Set up observer to enforce light mode
		const observer = new MutationObserver(() => {
			if (window.location.pathname === "/home") {
				document.documentElement.classList.remove("dark");
			}
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		// Cleanup function - restores original behavior when component unmounts
		return () => {
			// Restore original localStorage.setItem
			localStorage.setItem = originalSetItem;

			// Disconnect observer
			observer.disconnect();
		};
	}, []);

	return <div className="light">{children}</div>;
};

export default HomeLayout;
