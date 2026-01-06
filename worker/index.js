// This file contains custom service worker code that will be injected into the generated service worker

// Disable workbox logging in production
self.__WB_DISABLE_DEV_LOGS = true;

// Handle push notifications
self.addEventListener("push", (event) => {
	if (event.data) {
		const data = event.data.json();
		const options = {
			body: data.body || "New notification from Proddy",
			icon: data.icon || "/logo-nobg.png",
			badge: "/favicon.ico",
			vibrate: [100, 50, 100],
			data: {
				dateOfArrival: Date.now(),
				primaryKey: "1",
				url: data.url || "/",
			},
		};
		event.waitUntil(
			self.registration.showNotification(
				data.title || "Proddy Notification",
				options
			)
		);
	}
});

// Handle notification click
self.addEventListener("notificationclick", (event) => {
	event.notification.close();

	// This looks to see if the current is already open and focuses if it is
	event.waitUntil(
		clients
			.matchAll({
				type: "window",
			})
			.then((clientList) => {
				const url = event.notification.data.url || "/";

				for (let i = 0; i < clientList.length; i++) {
					const client = clientList[i];
					if (client.url === url && "focus" in client) {
						return client.focus();
					}
				}

				if (clients.openWindow) {
					return clients.openWindow(url);
				}
			})
	);
});

// Handle offline fallback
const offlineFallbackPage = "/offline";

// Cache the offline page on install
self.addEventListener("install", (event) => {
	event.waitUntil(
		caches
			.open("offline-cache")
			.then((cache) =>
				cache.addAll([offlineFallbackPage, "/logo-nobg.png", "/favicon.ico"])
			)
	);
});

// Network first, falling back to cache strategy for navigation requests
self.addEventListener("fetch", (event) => {
	// Skip non-GET requests
	if (event.request.method !== "GET") return;

	// For navigation requests (HTML pages), use a network-first strategy
	if (event.request.mode === "navigate") {
		event.respondWith(
			fetch(event.request).catch(() => caches.match(offlineFallbackPage))
		);
		return;
	}

	// For other requests, use the default strategy from workbox
});
