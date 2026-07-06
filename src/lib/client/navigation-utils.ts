"use client";

// Custom event type for navigation
export interface NavigationEvent extends CustomEvent {
	detail: {
		url: string;
	};
}

// Function to navigate to a URL without reloading the page or opening a new tab
export const navigateWithoutReload = (url: string): void => {
	// Dispatch a custom navigation event that React components can listen to
	const navigationEvent = new CustomEvent("navigate", {
		detail: { url },
	}) as NavigationEvent;

	window.dispatchEvent(navigationEvent);
};
