import {
	convexAuthNextjsMiddleware,
	createRouteMatcher,
	isAuthenticatedNextjs,
	nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";
import { NextResponse } from "next/server";

// Define public pages that don't require authentication
const _isPublicPage = createRouteMatcher([
	"/auth",
	"/",
	"/home",
	"/auth/signin",
	"/auth/signup",
	"/auth/forgot-password",
	"/auth/reset-password",
	"/about",
	"/contact",
	"/privacy",
	"/terms",
	"/features",
	"/pricing",
	"/why-proddy",
	"/assistant",
]);

// Define authenticated-only pages
const isAuthenticatedOnlyPage = createRouteMatcher([
	"/workspace",
	"/workspace/*",
	"/auth/join/:workspaceId",
]);

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;

const authMiddleware = convexAuthNextjsMiddleware(
	(req) => {
		// If trying to access authenticated-only pages without being logged in
		if (isAuthenticatedOnlyPage(req) && !isAuthenticatedNextjs()) {
			return nextjsMiddlewareRedirect(req, "/auth/signin");
		}

		if (
			(req.nextUrl.pathname === "/auth" ||
				req.nextUrl.pathname === "/auth/signin" ||
				req.nextUrl.pathname === "/auth/signup") &&
			isAuthenticatedNextjs()
		) {
			return nextjsMiddlewareRedirect(req, "/workspace");
		}

		// If accessing the root page while authenticated, redirect to workspace
		if (req.nextUrl.pathname === "/" && isAuthenticatedNextjs()) {
			return nextjsMiddlewareRedirect(req, "/workspace");
		}

		// If accessing the root page while not authenticated, redirect to home
		if (req.nextUrl.pathname === "/" && !isAuthenticatedNextjs()) {
			return nextjsMiddlewareRedirect(req, "/home");
		}
	},
	convexUrl ? { convexUrl } : undefined
);

// Convex's fetchAction wraps backend errors in messages like:
//   "[CONVEX A(auth:signIn)] [Request ID: ...] Server Error\nUncaught Error: Invalid credentials\n  at ..."
// Pull out the underlying reason so the client gets something useful.
function extractConvexErrorMessage(error: unknown): string {
	if (!(error instanceof Error)) {
		return typeof error === "string" ? error : "Authentication failed";
	}
	const msg = error.message ?? "";
	const uncaught = msg.match(/Uncaught Error:\s*([^\n]+)/);
	if (uncaught?.[1]) return uncaught[1].trim();
	const serverError = msg.match(/Server Error\s*\n([^\n]+)/);
	if (serverError?.[1]) return serverError[1].trim();
	return msg || "Authentication failed";
}

export default async function middleware(
	req: Parameters<typeof authMiddleware>[0],
	event: Parameters<typeof authMiddleware>[1]
) {
	// Allow OAuth callback routes to pass through without auth handling
	// These routes must be publicly accessible for OAuth to work
	const oauthCallbackPaths = [
		"/api/import/slack/callback",
		"/api/import/todoist/callback",
		"/api/import/linear/callback",
	];

	if (oauthCallbackPaths.some((path) => req.nextUrl.pathname === path)) {
		return NextResponse.next();
	}

	// Wrap the Convex auth proxy so that errors thrown inside the backend
	// authorize() callback (e.g. "Invalid credentials") come back as JSON
	// instead of Next.js's default HTML 500 page — which would break
	// `await response.json()` on the client with "Unexpected token 'A'...".
	if (req.nextUrl.pathname === "/api/auth") {
		try {
			return await authMiddleware(req, event);
		} catch (error) {
			const message = extractConvexErrorMessage(error);
			console.error("[/api/auth] proxy error:", message);
			return NextResponse.json({ error: message }, { status: 400 });
		}
	}

	return authMiddleware(req, event);
}

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
