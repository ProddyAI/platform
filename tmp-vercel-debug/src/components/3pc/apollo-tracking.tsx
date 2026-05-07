"use client";

import Script from "next/script";

declare global {
	interface Window {
		trackingFunctions?: {
			onLoad?: (options: { appId: string }) => void;
		};
	}
}

export const ApolloTracking = () => {
	const appId = process.env.NEXT_PUBLIC_APOLLO_APP_ID;
	if (!appId) return null;

	const cacheBuster = Math.random().toString(36).substring(7);

	return (
		<Script
			id="apollo-tracking"
			onLoad={() => {
				window.trackingFunctions?.onLoad?.({ appId });
			}}
			src={`https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache=${cacheBuster}`}
			strategy="afterInteractive"
		/>
	);
};
