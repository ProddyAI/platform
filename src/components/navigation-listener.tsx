"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { NavigationEvent } from "@/lib/navigation-utils";

export const NavigationListener = () => {
	const router = useRouter();

	useEffect(() => {
		const handleNavigation = (event: NavigationEvent) => {
			const { url } = event.detail;

			try {
				router.push(url);
			} catch (error) {
				console.error("Router navigation failed:", error);
				window.location.href = url;
			}
		};

		window.addEventListener("navigate", handleNavigation as EventListener);

		return () => {
			window.removeEventListener("navigate", handleNavigation as EventListener);
		};
	}, [router]);

	return null;
};
