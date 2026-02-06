import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
	let convexUrl = process.env.NEXT_PUBLIC_CONVEX_HTTP_URL;

	if (!convexUrl) {
		const convexCloudUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
		if (convexCloudUrl && convexCloudUrl.includes(".convex.cloud")) {
			convexUrl = convexCloudUrl.replace(".convex.cloud", ".convex.site");
		} else {
			console.warn(
				"Neither NEXT_PUBLIC_CONVEX_HTTP_URL is set nor a valid .convex.cloud URL was found. " +
				"Please set NEXT_PUBLIC_CONVEX_HTTP_URL for production."
			);

			if (process.env.NODE_ENV === "production") {
				return new NextResponse(
					"NEXT_PUBLIC_CONVEX_HTTP_URL is not properly configured for production",
					{
					status: 500,
					}
				);
			}
		}
	}

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

	// If Slack returned an error, forward it to the Convex handler
	if (error) {
		const targetUrl = new URL("/import/slack/callback", convexUrl);
		url.searchParams.forEach((value, key) => {
			targetUrl.searchParams.append(key, value);
		});
		return NextResponse.redirect(targetUrl.toString(), 302);
	}

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
