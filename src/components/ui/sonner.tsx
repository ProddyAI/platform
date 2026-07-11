"use client";

import * as React from "react";
import { Toaster as Sonner } from "sonner";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
	const [isDark, setIsDark] = React.useState(false);

	React.useEffect(() => {
		const root = document.documentElement;

		const updateIsDark = () => {
			setIsDark(root.classList.contains("dark"));
		};

		updateIsDark();

		const observer = new MutationObserver(updateIsDark);
		observer.observe(root, {
			attributeFilter: ["class"],
			attributes: true,
		});

		return () => observer.disconnect();
	}, []);

	return (
		<Sonner
			className="toaster group"
			theme={isDark ? "dark" : "light"}
			toastOptions={{
				classNames: {
					toast:
						"group toast group-[.toaster]:bg-popover group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
					description: "group-[.toast]:text-muted-foreground",
					actionButton:
						"group-[.toast]:bg-secondary group-[.toast]:text-secondary-foreground",
					cancelButton:
						"group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
				},
			}}
			{...props}
		/>
	);
};

export { Toaster };
