"use client";

import { useEffect, useState } from "react";
import { logger } from "@/lib/logger";

/**
 * Comprehensive ad blocker detection hook
 * Detects both built-in browser ad blockers (Brave Shields, etc.) and extensions
 * (uBlock Origin, AdBlock Plus, AdGuard, etc.)
 */
export const useAdBlockerDetection = (): boolean => {
	const [isAdBlockerActive, setIsAdBlockerActive] = useState(false);

	useEffect(() => {
		let isCancelled = false;

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

				// Method 3: Test fetch request to ad server (network-based detection)
				if (detectionScore < detectionThreshold) {
					try {
						const fetchPromise = Promise.race([
							fetch("https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js", {
								mode: "no-cors",
								cache: "no-store",
							}),
							new Promise<Response>((_, reject) =>
								setTimeout(() => reject(new Error("Timeout")), 2000)
							),
						]);

						await fetchPromise;
						// If fetch succeeds or times out, assume no blocker
					} catch {
						// If fetch fails, likely blocked
						detectionScore++;
					}
				}

				// Method 4: Test image request to ad server (1x1 pixel tracking endpoint)
				if (detectionScore < detectionThreshold) {
					try {
						const testImage = new Image();
						const imageLoadPromise = new Promise<boolean>((resolve) => {
							testImage.onload = () => resolve(false); // Image loaded = no blocker
							testImage.onerror = () => resolve(true); // Image blocked = blocker present

							// Timeout after 2 seconds
							setTimeout(() => resolve(false), 2000);
						});

						// Use an actual image endpoint (not a JS file) to avoid false positives
						const imageUrl = `https://pagead2.googlesyndication.com/pagead/imp.gif?t=${Date.now()}`;
						testImage.src = imageUrl;

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
				if (isCancelled) return;
				const isBlocked = detectionScore >= detectionThreshold;
				setIsAdBlockerActive(isBlocked);

				// Optional: Log for debugging (dev only)
				if (process.env.NODE_ENV === "development") {
					logger.debug(
						`Ad blocker detection score: ${detectionScore} (threshold: ${detectionThreshold})`
					);
				}
			} catch (error) {
				if (isCancelled) return;
				if (process.env.NODE_ENV === "development") {
					logger.debug("Ad blocker detection error:", error);
				}
				setIsAdBlockerActive(false);
			}
		};

		if (typeof window !== "undefined" && document.body) {
			// Delay to ensure DOM is fully ready
			const timer = setTimeout(detectAdBlocker, 500);
			return () => {
				isCancelled = true;
				clearTimeout(timer);
			};
		}

		return () => {
			isCancelled = true;
		};
	}, []);

	return isAdBlockerActive;
};
