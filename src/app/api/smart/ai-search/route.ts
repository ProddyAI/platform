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
		let body: unknown;
		try {
			body = await request.json();
		} catch {
			return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
		}

		const { workspaceId, query } = body as {
			workspaceId?: unknown;
			query?: unknown;
		};
		const trimmedWorkspaceId =
			typeof workspaceId === "string" ? workspaceId.trim() : "";
		const trimmedQuery = typeof query === "string" ? query.trim() : "";

		// Validate inputs
		if (
			!trimmedWorkspaceId ||
			!/^[a-zA-Z0-9_-]+$/.test(trimmedWorkspaceId) ||
			!trimmedQuery
		) {
			return NextResponse.json(
				{ error: "Missing or invalid parameters" },
				{ status: 400 }
			);
		}

		// Create Convex client with auth token
		const client = createConvexClient();
		let token: string | null | undefined = null;
		try {
			token = await convexAuthNextjsToken();
		} catch (err) {
			console.warn("[AI Search] Failed to read Convex auth token from request", err);
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		if (!token) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}
		client.setAuth(token);

		// Fetch search data from Convex
		const searchData = await client.query(api.aiSearch.getSearchData, {
			workspaceId: trimmedWorkspaceId as Id<"workspaces">,
		});

		// Call Convex AI search action
		const result = await client.action(api.aiSearch.aiSearch, {
			query: trimmedQuery,
			searchData,
		});

		return NextResponse.json(result);
	} catch (error) {
		console.error("AI Search API error:", error);
		return NextResponse.json(
			{
				success: false,
				error: "AI search failed",
				answer: null,
				sources: [],
			},
			{ status: 500 }
		);
	}
}
