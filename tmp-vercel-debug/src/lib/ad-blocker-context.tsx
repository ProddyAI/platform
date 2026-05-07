"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface AdBlockerContextType {
	isAdBlockerActive: boolean;
	isLoading: boolean;
}

const AdBlockerContext = createContext<AdBlockerContextType | undefined>(
	undefined
);

export const AdBlockerProvider = ({
	children,
}: {
	children: React.ReactNode;
}) => {
	const [isAdBlockerActive, setIsAdBlockerActive] = useState(false);
	const [isLoading, setIsLoading] = useState(true);

	useEffect(() => {
		// Use the ad-blocker detection logic once at app root level
		let cancelled = false;

		const detectAdBlocker = async () => {
			// Test fetch request to ad server with timeout
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), 2000);

			try {
				await fetch(
					"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js",
					{
						mode: "no-cors",
						cache: "no-store",
						signal: controller.signal,
					}
				);
				// If fetch succeeds, no blocker detected
				if (!cancelled) {
					setIsAdBlockerActive(false);
					setIsLoading(false);
				}
			} catch (_error) {
				// If fetch fails (abort, network error), likely blocked
				if (!cancelled) {
					setIsAdBlockerActive(true);
					setIsLoading(false);
				}
			} finally {
				clearTimeout(timeoutId);
			}
		};

		detectAdBlocker();

		return () => {
			cancelled = true;
		};
	}, []);

	return (
		<AdBlockerContext.Provider value={{ isAdBlockerActive, isLoading }}>
			{children}
		</AdBlockerContext.Provider>
	);
};

/**
 * Hook to access ad-blocker detection state from context
 * Must be used inside AdBlockerProvider
 */
export const useAdBlockerDetectionContext = (): {
	isAdBlockerActive: boolean;
	isLoading: boolean;
} => {
	const context = useContext(AdBlockerContext);
	if (!context) {
		throw new Error(
			"useAdBlockerDetectionContext must be used inside AdBlockerProvider"
		);
	}
	return {
		isAdBlockerActive: context.isAdBlockerActive,
		isLoading: context.isLoading,
	};
};
