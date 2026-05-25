"use client";

import { useEffect } from "react";

export default function Error({
	error,
	reset,
}: {
	error: Error & { digest?: string };
	reset: () => void;
}) {
	useEffect(() => {
		// Log the error to an error reporting service
		console.error("Workspace Page Error:", error);
	}, [error]);

	return (
		<div className="flex h-screen flex-col items-center justify-center bg-red-50 text-red-900 p-8">
			<h2 className="text-2xl font-bold mb-4">
				Something went wrong in /workspace!
			</h2>
			<p className="font-mono text-sm bg-white p-4 rounded shadow mb-4 max-w-2xl overflow-auto">
				{error.message}
			</p>
			<button
				className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
				onClick={() => reset()}
				type="button"
			>
				Try again
			</button>
		</div>
	);
}
