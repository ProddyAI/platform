"use client";

import { Moon, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

const getPreferredTheme = (): "light" | "dark" => {
	try {
		const stored = localStorage.getItem("theme");
		if (stored === "light" || stored === "dark") {
			return stored;
		}
		return window.matchMedia("(prefers-color-scheme: dark)").matches
			? "dark"
			: "light";
	} catch (_e) {
		return "light";
	}
};

export const ThemeToggle = () => {
	const [theme, setTheme] = useState<"light" | "dark" | null>(null);

	useEffect(() => {
		setTheme(getPreferredTheme());
	}, []);

	useEffect(() => {
		if (!theme) return;
		try {
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
			aria-label="Toggle color theme"
			className="rounded-full border border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
			onClick={toggle}
			size="iconSm"
			variant="ghost"
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
