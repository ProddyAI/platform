"use client";

import { type PropsWithChildren, useEffect } from "react";

const HomeLayout = ({ children }: Readonly<PropsWithChildren>) => {
	useEffect(() => {
		// Force light mode: /home is a public marketing page and shouldn't
		// inherit a signed-in user's dark workspace theme. Nothing can re-add
		// "dark" while this layout is mounted: Next.js App Router only mounts
		// one route's layout tree at a time, and both places that add the
		// class (the workspace layout's beforeInteractive theme-init script,
		// and the theme toggle rendered inside the workspace toolbar) live in
		// the separate /workspace route tree. So a single removal on mount
		// (covering client-side navigation, where the root layout's
		// initial-load script doesn't rerun) is enough — no need to keep
		// fighting the class with a persistent observer.
		document.documentElement.classList.remove("dark");
	}, []);

	return <div className="light">{children}</div>;
};

export default HomeLayout;
