"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth } from "convex/react";
import { Loader2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";

export default function AutoLogin() {
	const { signIn } = useAuthActions();
	const { isAuthenticated, isLoading } = useConvexAuth();
	const hasAttempted = useRef(false);
	const [errorMsg, setErrorMsg] = useState<string | null>(null);

	useEffect(() => {
		if (isAuthenticated) {
			window.location.href = "/workspace";
			return;
		}

		if (!isLoading && !isAuthenticated && !hasAttempted.current) {
			hasAttempted.current = true;
			const doBypass = async () => {
				const friendlyError = (raw: unknown): string => {
					const msg = raw instanceof Error ? raw.message : String(raw);
					// Hide low-level JSON / fetch errors from end users — they
					// happen when the auth endpoint returns a non-JSON body
					// (e.g. a generic Next.js error page). Show something useful.
					if (
						/Unexpected token|is not valid JSON|Failed to fetch|NetworkError/i.test(
							msg
						)
					) {
						return "Unable to reach the authentication service. Please try again.";
					}
					return msg || "Authentication failed";
				};

				try {
					// Try to sign in
					const signInResult = await signIn("password", {
						email: "admin@proddy.ai",
						password: "password123",
						flow: "signIn",
					});
					if (signInResult?.signingIn) {
						window.location.href = "/workspace";
						return;
					}

					// Fall back to sign up if sign-in did not succeed
					const signUpResult = await signIn("password", {
						email: "admin@proddy.ai",
						password: "password123",
						name: "Admin",
						flow: "signUp",
					});
					if (signUpResult?.signingIn) {
						window.location.href = "/workspace";
						return;
					}

					setErrorMsg(
						"Auto-login is unavailable. Please sign in with your account."
					);
				} catch (err) {
					console.error("Auto login failed:", err);
					setErrorMsg(friendlyError(err));
				}
			};
			doBypass();
		}
	}, [isAuthenticated, isLoading, signIn]);

	if (errorMsg) {
		return (
			<div className="flex h-screen w-full flex-col items-center justify-center bg-[#4A0D68] text-white">
				<p className="text-xl font-bold text-red-400">Auto-login Failed</p>
				<p className="mt-2 text-sm">{errorMsg}</p>
				<div className="mt-4 flex gap-2">
					<button
						className="rounded bg-white px-4 py-2 text-[#4A0D68]"
						onClick={() => window.location.reload()}
						type="button"
					>
						Retry
					</button>
					<button
						className="rounded border border-white px-4 py-2 text-white"
						onClick={() => {
							window.location.href = "/auth/signin";
						}}
						type="button"
					>
						Sign in
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className="flex h-screen w-full items-center justify-center bg-[#4A0D68] text-white">
			<div className="flex flex-col items-center gap-4">
				<Loader2 className="h-8 w-8 animate-spin" />
				<p className="text-lg font-medium animate-pulse">
					Authenticating Workspace...
				</p>
			</div>
		</div>
	);
}
