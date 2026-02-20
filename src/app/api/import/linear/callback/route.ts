import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function buildCallbackRedirect(
	convexUrl: string,
	searchParams: URLSearchParams
): NextResponse {
	const targetUrl = new URL("/import/linear/callback", convexUrl);
	searchParams.forEach((value, key) => {
		targetUrl.searchParams.append(key, value);
	});
	return NextResponse.redirect(targetUrl.toString(), 302);
}

export async function GET(request: Request) {
	let convexUrl = process.env.NEXT_PUBLIC_CONVEX_HTTP_URL;

	if (!convexUrl) {
		const convexCloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (convexCloudUrl?.includes(".convex.cloud")) {
			convexUrl = convexCloudUrl.replace(".convex.cloud", ".convex.site");
		}
	}

	if (!convexUrl) {
		return new NextResponse("Convex URL not configured", { status: 500 });
	}

	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (error) {
		return buildCallbackRedirect(convexUrl, url.searchParams);
	}

	if (!code || !state) {
		return new NextResponse("Missing OAuth code or state", { status: 400 });
	}

	return buildCallbackRedirect(convexUrl, url.searchParams);
}
