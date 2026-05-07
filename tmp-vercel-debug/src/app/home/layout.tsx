"use client";

import { type PropsWithChildren, useEffect } from "react";

const HomeLayout = ({ children }: Readonly<PropsWithChildren>) => {
	useEffect(() => {
		// Force light mode
		document.documentElement.classList.remove("dark");

		// Set up observer to enforce light mode
		// Since this layout only mounts for /home route, no pathname check needed
		const observer = new MutationObserver(() => {
			document.documentElement.classList.remove("dark");
		});

		observer.observe(document.documentElement, {
			attributes: true,
			attributeFilter: ["class"],
		});

		// Cleanup function
		return () => {
			// Disconnect observer
			observer.disconnect();
		};
	}, []);

	return <div className="light">{children}</div>;
};

export default HomeLayout;
