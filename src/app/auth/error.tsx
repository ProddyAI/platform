"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function AuthError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Auth Error:", error);
	}, [error]);

	return (
		<div className="flex flex-col items-center justify-center h-screen space-y-4">
			<h2 className="text-xl font-bold text-destructive">
				Authentication Error
			</h2>
			<p className="text-muted-foreground">
				{error.message || "Something went wrong"}
			</p>
			<Button onClick={() => reset()}>Try Again</Button>
		</div>
	);
}
