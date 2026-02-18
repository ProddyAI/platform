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

export default function middleware(
	req: Parameters<typeof authMiddleware>[0],
	event: Parameters<typeof authMiddleware>[1]
) {
	// Allow Slack OAuth callback to pass through without auth handling
	if (req.nextUrl.pathname === "/api/import/slack/callback") {
		return NextResponse.next();
	}

	return authMiddleware(req, event);
}

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
