import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	const convexUrl =
		process.env.NEXT_PUBLIC_CONVEX_HTTP_URL ||
		process.env.NEXT_PUBLIC_CONVEX_URL?.replace(
			".convex.cloud",
			".convex.site"
		);
	if (!convexUrl) {
		return new NextResponse(
			"NEXT_PUBLIC_CONVEX_HTTP_URL or NEXT_PUBLIC_CONVEX_URL is not configured",
			{
			status: 500,
			}
		);
	}

	const url = new URL(request.url);
	const code = url.searchParams.get("code");
	const state = url.searchParams.get("state");
	const error = url.searchParams.get("error");

	if (!code || !state) {
		return new NextResponse(
			"Missing OAuth code or state. Please retry Slack authorization.",
			{ status: 400 }
		);
	}

	const targetUrl = new URL("/import/slack/callback", convexUrl);
	url.searchParams.forEach((value, key) => {
		targetUrl.searchParams.append(key, value);
	});

	return NextResponse.redirect(targetUrl.toString(), 302);
}
