import Script from "next/script";

export const ClarityTracking = () => {
	const projectId = process.env.NEXT_PUBLIC_CLARITY_PROJECT_ID;
	if (!projectId) return null;

	return (
		<Script
			id="clarity-tracking"
			src={`https://www.clarity.ms/tag/${projectId}`}
			strategy="afterInteractive"
		/>
	);
};
