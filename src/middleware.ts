import { type NextRequest, NextResponse } from "next/server";

// Define public pages that don't require authentication
const _publicPages = [
	"/auth",
	"/",
	"/home",
	"/signin",
	"/signup",
	"/about",
	"/contact",
	"/privacy",
	"/terms",
	"/features",
	"/pricing",
	"/why-proddy",
	"/assistant",
];

// Define authenticated-only pages
const _authenticatedOnlyPages = ["/workspace"];

export function middleware(request: NextRequest) {
	try {
		const _pathname = request.nextUrl.pathname;

		// Allow all requests to proceed - authentication is handled client-side
		return NextResponse.next();
	} catch (error) {
		// If middleware fails, allow request to proceed
		console.error("Middleware error:", error);
		return NextResponse.next();
	}
}

export const config = {
	// The following matcher runs middleware on all routes
	// except static assets.
	matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};

// Use Node.js runtime instead of Edge Runtime to support OpenTelemetry instrumentation
export const runtime = "nodejs";
