"use client";

import { Home, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";

import { Button } from "@/components/ui/button";

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
		<div className="flex h-screen flex-col items-center justify-center bg-background px-4 text-center">
			<h2 className="text-2xl font-semibold text-foreground">
				Something went wrong
			</h2>
			<p className="mt-2 max-w-md text-sm text-muted-foreground">
				We hit a snag loading this workspace. Try again, or head back to your
				workspaces.
			</p>
			{error.digest && (
				<p className="mt-2 text-xs text-muted-foreground">
					Reference: {error.digest}
				</p>
			)}
			<div className="mt-6 flex flex-col gap-3 sm:flex-row">
				<Button onClick={() => reset()} type="button" variant="outline">
					<RefreshCw className="mr-2 size-4" />
					Try again
				</Button>
				<Button asChild variant="primary">
					<Link href="/workspace">
						<Home className="mr-2 size-4" />
						Go to workspaces
					</Link>
				</Button>
			</div>
		</div>
	);
}
