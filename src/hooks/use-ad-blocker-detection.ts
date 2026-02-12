"use client";

import { useEffect, useState } from "react";

/**
 * Comprehensive ad blocker detection hook
 * Detects both built-in browser ad blockers (Brave Shields, etc.) and extensions
 * (uBlock Origin, AdBlock Plus, AdGuard, etc.)
 */
export const useAdBlockerDetection = (): boolean => {
	const [isAdBlockerActive, setIsAdBlockerActive] = useState(false);

	useEffect(() => {
		const detectAdBlocker = async () => {
			try {
				let detectionScore = 0;
				const detectionThreshold = 1; // Need at least 1 positive detection

				// Method 1: Multiple bait elements with different ad-like attributes
				const baitTests = [
					{
						className:
							"adsbox ad-banner ad-placement advertisement pub_300x250",
						id: "google_ads_iframe_1",
					},
					{
						className: "ad-container adsbygoogle ad-slot",
						id: "ad-div",
					},
					{
						className: "textAd text_ad text-ads sponsorship sponsored-content",
						id: "banner_ad",
					},
				];

				for (const baitConfig of baitTests) {
					const bait = document.createElement("div");
					bait.innerHTML = "&nbsp;";
					bait.className = baitConfig.className;
					bait.id = baitConfig.id;
					bait.style.cssText =
						"width: 1px !important; height: 1px !important; position: absolute !important; left: -10000px !important; top: -1000px !important;";

					document.body.appendChild(bait);

					// Small delay for ad blockers to process
					await new Promise((resolve) => setTimeout(resolve, 50));

					// Check if element was blocked or hidden
					const computedStyle = window.getComputedStyle(bait);
					if (
						bait.offsetHeight === 0 ||
						bait.offsetWidth === 0 ||
						bait.offsetParent === null ||
						computedStyle.display === "none" ||
						computedStyle.visibility === "hidden" ||
						computedStyle.opacity === "0"
					) {
						detectionScore++;
					}

					// Clean up
					if (bait.parentNode) {
						document.body.removeChild(bait);
					}

					// Early exit if we've detected a blocker
					if (detectionScore >= detectionThreshold) {
						break;
					}
				}

				// Method 2: Check for ad blocker extension properties
				const adBlockerProps = [
					// @ts-expect-error
					() => typeof window.canRunAds !== "undefined" && !window.canRunAds,
					// @ts-expect-error
					() => typeof window.google_ad_modifications !== "undefined",
					// @ts-expect-error
					() => typeof window.isAdBlocked !== "undefined" && window.isAdBlocked,
				];

				for (const checkProp of adBlockerProps) {
					try {
						if (checkProp()) {
							detectionScore++;
							break;
						}
					} catch {
						// Ignore errors
					}
				}

				// Method 3: Test loading ad-related scripts (catches network-based blockers)
				if (detectionScore < detectionThreshold) {
					try {
						// Create a script element to test if it gets blocked
						const testScript = document.createElement("script");
						testScript.type = "text/javascript";
						testScript.async = true;
						testScript.src =
							"https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js";

						const scriptLoadPromise = new Promise<boolean>((resolve) => {
							testScript.onload = () => resolve(false); // Script loaded = no blocker
							testScript.onerror = () => resolve(true); // Script blocked = blocker present

							// Timeout after 2 seconds
							setTimeout(() => resolve(false), 2000);
						});

						// Append script temporarily
						document.head.appendChild(testScript);
						const isScriptBlocked = await scriptLoadPromise;

						// Clean up
						if (testScript.parentNode) {
							document.head.removeChild(testScript);
						}

						if (isScriptBlocked) {
							detectionScore++;
						}
					} catch {
						// If script creation fails, might be blocked
						detectionScore++;
					}
				}

				// Method 4: Test image request to ad server
				if (detectionScore < detectionThreshold) {
					try {
						const testImage = new Image();
						const imageLoadPromise = new Promise<boolean>((resolve) => {
							testImage.onload = () => resolve(false); // Image loaded = no blocker
							testImage.onerror = () => resolve(true); // Image blocked = blocker present

							// Timeout after 2 seconds
							setTimeout(() => resolve(false), 2000);
						});

						// Use a timestamp to prevent caching
						testImage.src = `https://pagead2.googlesyndication.com/pagead/show_ads.js?${Date.now()}`;

						const isImageBlocked = await imageLoadPromise;
						if (isImageBlocked) {
							detectionScore++;
						}
					} catch {
						// If image creation fails, might be blocked
						detectionScore++;
					}
				}

				// Set ad blocker status based on detection score
				const isBlocked = detectionScore >= detectionThreshold;
				setIsAdBlockerActive(isBlocked);

				// Optional: Log for debugging
				if (process.env.NODE_ENV === "development") {
					console.log(
						`Ad blocker detection score: ${detectionScore} (threshold: ${detectionThreshold})`
					);
				}
			} catch (error) {
				console.warn("Ad blocker detection error:", error);
				setIsAdBlockerActive(false);
			}
		};

		if (typeof window !== "undefined" && document.body) {
			// Delay to ensure DOM is fully ready
			const timer = setTimeout(detectAdBlocker, 500);
			return () => clearTimeout(timer);
		}
	}, []);

	return isAdBlockerActive;
};
