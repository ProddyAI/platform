"use client";

import { useEffect } from "react";

export const DevServiceWorkerCleanup = () => {
	useEffect(() => {
		// Only run on localhost/loopback to keep production PWA behavior intact.
		const hostname = window.location.hostname;
		const isLocalhost =
			hostname === "localhost" ||
			hostname === "127.0.0.1" ||
			hostname === "::1" ||
			hostname.endsWith(".localhost");

		if (!isLocalhost) return;
		if (!("serviceWorker" in navigator)) return;

		(async () => {
			try {
				const registrations = await navigator.serviceWorker.getRegistrations();
				await Promise.all(registrations.map((r) => r.unregister()));

				if ("caches" in window) {
					const keys = await caches.keys();
					await Promise.all(keys.map((k) => caches.delete(k)));
				}
			} catch {
				// Best-effort cleanup only.
			}
		})();
	}, []);

	return null;
};
