import Script from "next/script";

export const ClarityTracking = () => {
    const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
    if (!projectId) return null;

    return (
        <Script
            id="clarity-tracking"
            strategy="afterInteractive"
            src={`https://www.clarity.ms/tag/${projectId}`}
        />
    );
};
