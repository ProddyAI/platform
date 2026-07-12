import type { Metadata } from "next";

export const siteConfig: Metadata = {
	title: "Proddy",
	description:
		"A vibrant team collaboration platform with real-time messaging, rich text editing, and emoji support.",
	keywords: [
		"work management software",
		"team collaboration platform",
		"project management tool",
		"team productivity software",
		"all-in-one workspace",
		"remote team collaboration",

		"team messaging app",
		"team chat software",
		"direct messages and channels",
		"real-time messaging",
		"threads and mentions",

		"task management software",
		"kanban board",
		"issue tracking",
		"task dependencies",
		"sprint planning tool",
		"project roadmap",
		"milestone tracking",

		"collaborative whiteboard",
		"online canvas",
		"visual collaboration",

		"collaborative notes app",
		"rich text editor",
		"meeting notes software",

		"team calendar",
		"video meetings",
		"online meetings",

		"reports and analytics",
		"team dashboard",

		"AI assistant for work",
		"agentic AI assistant",
		"AI task management",
		"AI search",

		"Slack integration",
		"Linear integration",
		"Todoist integration",
		"Gmail integration",
		"third-party integrations",
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
