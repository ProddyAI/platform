import Script from "next/script";

export const GoogleAnalyticsTracking = () => {
    const measurementId = process.env.NEXT_PUBLIC_GOOGLE_ANALYTICS_ID;
    if (!measurementId) return null;

    return (
        <>
            <Script
                id="google-analytics"
                src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`}
                strategy="afterInteractive"
            />
            <Script
                id="google-analytics-config"
                strategy="afterInteractive"
                dangerouslySetInnerHTML={{
                    __html: `
						window.dataLayer = window.dataLayer || [];
						function gtag(){dataLayer.push(arguments);}
						gtag('js', new Date());
						gtag('config', '${measurementId}');
					`,
                }}
            />
        </>
    );
};
