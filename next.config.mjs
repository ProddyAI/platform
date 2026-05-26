/* eslint-env node */

/* eslint-disable no-undef */

/* global process */

/** @type {import('next').NextConfig} */
import withPWA from "next-pwa";

const isWindows = process.platform === "win32";
const disablePWA =
	process.env.NODE_ENV === "development" ||
	process.env.NEXT_PUBLIC_ENABLE_PWA !== "true" ||
	process.env.DISABLE_PWA_BUILD === "true";

const baseConfig = withPWA({
	dest: "public",
	register: true,
	skipWaiting: true,
	disable: disablePWA,
	customWorkerDir: "worker",
	// Avoid Workbox precache warnings and bloated caches by excluding sourcemaps.
	buildExcludes: [/\.map$/, /OneSignalSDK\.sw\.js$/, /OneSignalSDKWorker\.js$/],
	runtimeCaching: [
		{
			urlPattern: /^https:\/\/fonts\.(?:gstatic|googleapis)\.com\/.*/i,
			handler: "CacheFirst",
			options: {
				cacheName: "google-fonts",
				expiration: {
					maxEntries: 20,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-font-assets",
				expiration: {
					maxEntries: 20,
					maxAgeSeconds: 60 * 60 * 24 * 365, // 1 year
				},
			},
		},
		{
			urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-image-assets",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			urlPattern: /\/_next\/image\?url=.+$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "next-image",
				expiration: {
					maxEntries: 64,
					maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
				},
			},
		},
		{
			urlPattern: /\.(?:mp3|wav|ogg)$/i,
			handler: "CacheFirst",
			options: {
				cacheName: "static-audio-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				},
			},
		},
		{
			urlPattern: /\.(?:mp4|webm)$/i,
			handler: "CacheFirst",
			options: {
				cacheName: "static-video-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				},
			},
		},
		{
			urlPattern: /\.(?:js)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-js-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				},
			},
		},
		{
			urlPattern: /\.(?:css|less)$/i,
			handler: "StaleWhileRevalidate",
			options: {
				cacheName: "static-style-assets",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60 * 24 * 7, // 7 days
				},
			},
		},
		{
			urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "next-data",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60, // 1 hour
				},
			},
		},
		{
			urlPattern: /\/api\/.*$/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "apis",
				expiration: {
					maxEntries: 16,
					maxAgeSeconds: 60 * 60, // 1 hour
				},
				networkTimeoutSeconds: 10, // fall back to cache if api doesn't respond within 10 seconds
			},
		},
		{
			urlPattern: /.*/i,
			handler: "NetworkFirst",
			options: {
				cacheName: "others",
				expiration: {
					maxEntries: 32,
					maxAgeSeconds: 60 * 60, // 1 hour
				},
				networkTimeoutSeconds: 10,
			},
		},
	],
})({
	distDir: process.env.NEXT_DIST_DIR || ".next",
	images: {
		remotePatterns: [
			{
				protocol: "https",
				hostname: "getstream.io",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "*.convex.cloud",
				pathname: "/**",
			},
			{
				protocol: "https",
				hostname: "*.convex.dev",
				pathname: "/**",
			},
		],
	},

	async headers() {
		await Promise.resolve();
		return [
			{
				source: "/OneSignalSDK.sw.js",
				headers: [
					{
						key: "Service-Worker-Allowed",
						value: "/",
					},
					{
						key: "Content-Type",
						value: "application/javascript; charset=utf-8",
					},
					{
						key: "Cache-Control",
						value: "no-cache, no-store, must-revalidate",
					},
				],
			},
			{
				source: "/OneSignalSDKWorker.js",
				headers: [
					{
						key: "Service-Worker-Allowed",
						value: "/",
					},
					{
						key: "Content-Type",
						value: "application/javascript; charset=utf-8",
					},
					{
						key: "Cache-Control",
						value: "no-cache, no-store, must-revalidate",
					},
				],
			},
		];
	},
	env: {
		// Ensure Convex URL is available in client bundle
		NEXT_PUBLIC_CONVEX_URL: process.env.NEXT_PUBLIC_CONVEX_URL,
	},
	eslint: {
		ignoreDuringBuilds: true,
	},
	typescript: {
		// `bun run build` runs `tsc --noEmit` first. Skipping Next's duplicate
		// type worker avoids Windows spawn/worker stalls without hiding TS errors.
		ignoreBuildErrors: process.env.NEXT_IGNORE_TS_ERRORS === "true",
	},
	experimental: {
		serverComponentsExternalPackages: ["yjs"],
		// Windows + OneDrive can throw EPERM while Next forks workers and renames
		// cache/export folders. Keep local Windows builds single-worker; CI/Linux
		// builds can still use the default parallelism.
		cpus:
			isWindows || process.env.CI || process.env.LIMIT_BUILD_CPUS
				? 1
				: undefined,
		workerThreads: true,
	},
	webpack(config, { dev }) {
		config.resolve.alias = {
			...config.resolve.alias,
			yjs: "yjs",
		};
		if (!dev) {
			config.cache = false;
		}
		return config;
	},
});

export default baseConfig;
