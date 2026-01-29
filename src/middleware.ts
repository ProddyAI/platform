import {
	convexAuthNextjsMiddleware,
	createRouteMatcher,
	isAuthenticatedNextjs,
	nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

// Define public pages that don't require authentication
const _isPublicPage = createRouteMatcher([
	"/auth",
	"/",
	"/home",
	"/signin",
	"/signup",
	"/forgot-password",
	"/reset-password",
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
	"/join/:workspaceId",
]);

export default convexAuthNextjsMiddleware((req) => {
	// If trying to access authenticated-only pages without being logged in
	if (isAuthenticatedOnlyPage(req) && !isAuthenticatedNextjs()) {
		return nextjsMiddlewareRedirect(req, "/signin");
	}

	if (
		(req.nextUrl.pathname === "/auth" ||
			req.nextUrl.pathname === "/signin" ||
			req.nextUrl.pathname === "/signup") &&
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
});

export const config = {
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
