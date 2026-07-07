"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function GlobalError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("[GlobalError]", error);
	}, [error]);

	return (
		<html lang="en">
			<body className="flex h-screen flex-col items-center justify-center gap-4 px-6 text-center">
				<h1 className="text-xl font-semibold">Something went wrong</h1>
				<p className="max-w-sm text-sm text-muted-foreground">
					We hit an unexpected error and couldn&apos;t load the app.
					{error.digest ? ` Reference: ${error.digest}.` : ""}
				</p>
				<Button onClick={() => reset()}>Try again</Button>
			</body>
		</html>
	);
}
