import type { Metadata } from "next";

export const metadata: Metadata = {
	title: "Why Proddy | The Modern Solution for Team Productivity",
	description:
		"Discover why Proddy is the best choice for teams looking to streamline workflows, reduce tool fatigue, and boost productivity with an all-in-one platform.",
};

export default function WhyProddyLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return <div className="min-h-screen flex flex-col">{children}</div>;
}
