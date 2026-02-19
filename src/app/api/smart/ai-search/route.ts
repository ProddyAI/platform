import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export async function POST(request: NextRequest) {
	// Check authentication
	const isAuth = await isAuthenticatedNextjs();
	if (!isAuth) {
		return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
	}

	try {
		const { workspaceId, query } = await request.json();

		// Validate inputs
		if (!workspaceId || !query || typeof query !== "string") {
			return NextResponse.json(
				{ error: "Missing or invalid parameters" },
				{ status: 400 }
			);
		}

		// Get API key from environment
		const openRouterApiKey = process.env.OPENROUTER_API_KEY;
		if (!openRouterApiKey) {
			console.error("[AI Search API] OPENROUTER_API_KEY not configured");
			return NextResponse.json(
				{
					success: false,
					error: "AI service not configured",
					answer: null,
					sources: [],
				},
				{ status: 500 }
			);
		}

		// Create Convex client with auth token
		const client = createConvexClient();
		try {
			const token = await convexAuthNextjsToken();
			if (token) {
				client.setAuth(token);
			}
		} catch (err) {
			if (isAuth) {
				console.warn("[AI Search] Failed to read Convex auth token from request", err);
			}
		}

		// Fetch search data from Convex
		const searchData = await client.query(api.aiSearch.getSearchData, {
			workspaceId: workspaceId as Id<"workspaces">,
		});

		// Call Convex AI search action with API key
		const result = await client.action(api.aiSearch.aiSearch, {
			query: query.trim(),
			openRouterApiKey,
			searchData,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("AI Search API error:", error);
		return NextResponse.json(
			{
				success: false,
				error: `AI search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				answer: null,
				sources: [],
			},
			{ status: 500 }
		);
	}
}
