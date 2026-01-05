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

    const cacheBuster =
        typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
            ? crypto.randomUUID()
            : `${Date.now()}`;

    return (
        <Script
            id="apollo-tracking"
            src={`https://assets.apollo.io/micro/website-tracker/tracker.iife.js?nocache=${cacheBuster}`}
            strategy="afterInteractive"
            onLoad={() => {
                window.trackingFunctions?.onLoad?.({ appId });
            }}
        />
    );
};
