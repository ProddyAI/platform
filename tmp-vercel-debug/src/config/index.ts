import type { Metadata } from "next";

export const siteConfig: Metadata = {
	title: "Proddy",
	description:
		"A vibrant team collaboration platform with real-time messaging, rich text editing, and emoji support.",
	keywords: [
		"reactjs",
		"nextjs",
		"convex",
		"next-auth",
		"emoji-picker-react",
		"lucide-icons",
		"react-icons",
		"quill-editor",
		"shadcn-ui",
		"radix-ui",
		"tailwindcss",
		"nuqs",
		"sonner",

		"typescript",
		"javascript",
		"postcss",
		"prettier",
		"eslint",
		"react-dom",
		"html",
		"css",

		"state-management",
		"real-time-messaging",
		"collaboration",
		"ui/ux",
		"date-fns",
		"cn",
		"clsx",
		"lucide-react",
	] as Array<string>,
	authors: {
		name: "George Bobby",
		url: "https://github.com/george-bobby",
	},
	icons: {
		icon: [
			{
				url: "/favicon.ico",
				sizes: "32x32",
			},
			{
				url: "/logo-nobg.png",
				sizes: "192x192",
				type: "image/png",
			},
		],
		apple: {
			url: "/logo-nobg.png",
			sizes: "192x192",
			type: "image/png",
		},
	},
	manifest: "/manifest.json",
} as const;
