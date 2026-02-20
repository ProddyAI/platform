import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

/**
 * Helper function to build and return a redirect response to the Convex callback handler
 */
function buildCallbackRedirect(
	convexUrl: string,
	searchParams: URLSearchParams
): NextResponse {
	const targetUrl = new URL("/import/todoist/callback", convexUrl);
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
		} else {
			console.warn(
				"Neither NEXT_PUBLIC_CONVEX_HTTP_URL is set nor a valid .convex.cloud URL was found."
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

	// If Todoist returned an error, forward it to the Convex handler
	if (error) {
		let workspaceId = "";
		try {
			if (state) {
				const parsed = JSON.parse(base64UrlDecode(state));
				workspaceId = parsed.workspaceId || "";
			}
		} catch (_e) {
			// If state parsing fails, redirect to a safe default
		}

		const redirectPath = workspaceId
			? `/workspace/${workspaceId}/manage?tab=import&error=${encodeURIComponent(error)}`
			: `/manage?error=${encodeURIComponent(error)}`;

		return new Response(null, {
			status: 302,
			headers: {
				Location: `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}${redirectPath}`,
			},
		});
	}

	if (!code || !state) {
		return new NextResponse(
			"Missing OAuth code or state. Please retry Todoist authorization.",
			{ status: 400 }
		);
	}

	return buildCallbackRedirect(convexUrl, url.searchParams);
}

function base64UrlDecode(value: string): string {
	const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
	const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
	if (typeof atob === "function") {
		return atob(padded);
	}
	if (typeof Buffer !== "undefined") {
		return Buffer.from(padded, "base64").toString("utf8");
	}
	throw new Error("Base64 decode not supported");
}
