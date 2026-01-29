"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export const ThemeToggle = () => {
	const [theme, setTheme] = useState<"light" | "dark" | null>(null);

	useEffect(() => {
		try {
			const stored = localStorage.getItem("theme");
			if (stored === "light" || stored === "dark") {
				setTheme(stored as "light" | "dark");
			} else {
				setTheme("light");
			}
		} catch (_e) {
			// ignore
		}
	}, []);

	useEffect(() => {
		if (!theme) return;
		try {
			// Don't apply theme changes on /home route (it's locked to light mode)
			if (
				typeof window !== "undefined" &&
				window.location.pathname === "/home"
			) {
				return;
			}

			if (theme === "dark") {
				document.documentElement.classList.add("dark");
			} else {
				document.documentElement.classList.remove("dark");
			}
			localStorage.setItem("theme", theme);
		} catch (_e) {
			// ignore
		}
	}, [theme]);

	const toggle = () => setTheme((t) => (t === "dark" ? "light" : "dark"));

	return (
		<Button
			variant="ghost"
			size="iconSm"
			onClick={toggle}
			aria-label="Toggle color theme"
		>
			{theme === "dark" ? (
				<Sun className="size-5" />
			) : (
				<Moon className="size-5" />
			)}
		</Button>
	);
};

export default ThemeToggle;
