"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

function getAuthErrorMessage(error: Error & { digest?: string; code?: string }) {
	const errorCode = String(error.code ?? "").toLowerCase();
	const errorMessage = String(error.message ?? "").toLowerCase();

	if (
		errorCode.includes("accessdenied") ||
		errorMessage.includes("access denied")
	) {
		return "Access was denied. Please try signing in again.";
	}
	if (
		errorCode.includes("callback") ||
		errorMessage.includes("callback")
	) {
		return "The sign-in callback did not complete. Please try again.";
	}

	return "Could not sign you in. Please try again.";
}

export default function AuthError({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		console.error("Authentication error occurred", {
			code: (error as { code?: string }).code,
			digest: error.digest,
		});
	}, [error]);

	return (
		<div className="flex flex-col items-center justify-center h-screen space-y-4">
			<h2 className="text-xl font-bold text-destructive">
				Authentication Error
			</h2>
			<p className="text-muted-foreground">{getAuthErrorMessage(error)}</p>
			<Button onClick={() => reset()}>Try Again</Button>
		</div>
	);
}
