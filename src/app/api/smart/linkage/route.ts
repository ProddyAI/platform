import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const dynamic = "force-dynamic";

interface LinkagePayload {
	channelId?: unknown;
	blockedIssueId?: unknown;
	blockingIssueId?: unknown;
}

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === "string" && value.trim().length > 0;
}

async function createAuthenticatedConvexClient() {
	if (!isAuthenticatedNextjs()) {
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
			convex: null,
		};
	}

	const convex = createConvexClient();
	try {
		const token = convexAuthNextjsToken();
		if (!token) {
			return {
				error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
				convex: null,
			};
		}
		convex.setAuth(token);
		return { error: null, convex };
	} catch (error) {
		console.warn("[Smart Linkage] Failed to read Convex auth token", error);
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
			convex: null,
		};
	}
}

async function parseLinkagePayload(req: NextRequest) {
	let body: unknown;
	try {
		body = await req.json();
	} catch {
		return {
			error: NextResponse.json({ error: "Invalid JSON" }, { status: 400 }),
			payload: null,
		};
	}

	const { channelId, blockedIssueId, blockingIssueId } = body as LinkagePayload;
	if (
		!isNonEmptyString(channelId) ||
		!isNonEmptyString(blockedIssueId) ||
		!isNonEmptyString(blockingIssueId)
	) {
		return {
			error: NextResponse.json(
				{
					error:
						"channelId, blockedIssueId, and blockingIssueId are required",
				},
				{ status: 400 }
			),
			payload: null,
		};
	}

	return {
		error: null,
		payload: {
			channelId: channelId as Id<"channels">,
			blockedIssueId: blockedIssueId as Id<"issues">,
			blockingIssueId: blockingIssueId as Id<"issues">,
		},
	};
}

/**
 * GET /api/smart/linkage?channelId=<id>
 *
 * Returns the blocking/dependency graph for all issues in a channel.
 * Response shape: { edges: BlockingEdge[], mermaid: string }
 *
 * edges[n]: { blockingIssueId, blockedIssueId, blockingTitle, blockedTitle }
 * mermaid: ready-to-render "graph LR\n  ..." string, or "" if no edges
 */
export async function GET(req: NextRequest) {
	try {
		const auth = await createAuthenticatedConvexClient();
		if (auth.error || !auth.convex) return auth.error;

		const channelId = req.nextUrl.searchParams.get("channelId");
		if (!channelId?.trim()) {
			return NextResponse.json(
				{ error: "channelId query parameter is required" },
				{ status: 400 }
			);
		}

		const edges = await auth.convex.query(api.board.getChannelBlockingEdges, {
			channelId: channelId as Id<"channels">,
		});

		let mermaid = "";
		if (edges.length > 0) {
			const lines = edges.map((e) => {
				const fromId = e.blockingIssueId.replace(/[^a-zA-Z0-9]/g, "_");
				const toId = e.blockedIssueId.replace(/[^a-zA-Z0-9]/g, "_");
				const fromTitle = e.blockingTitle.replace(/"/g, "'");
				const toTitle = e.blockedTitle.replace(/"/g, "'");
				return `  ${fromId}["${fromTitle}"] --> ${toId}["${toTitle}"]`;
			});
			mermaid = `graph LR\n${lines.join("\n")}`;
		}

		return NextResponse.json({ edges, mermaid });
	} catch (error) {
		console.error("[Smart Linkage] Error:", error);
		return NextResponse.json({ error: "Internal server error" }, { status: 500 });
	}
}

/**
 * POST /api/smart/linkage
 *
 * Creates a blocking relationship between two issues.
 * Body: { channelId, blockedIssueId, blockingIssueId }
 */
export async function POST(req: NextRequest) {
	try {
		const auth = await createAuthenticatedConvexClient();
		if (auth.error || !auth.convex) return auth.error;

		const parsed = await parseLinkagePayload(req);
		if (parsed.error || !parsed.payload) return parsed.error;

		await auth.convex.mutation(api.board.addIssueBlockingRelationship, {
			channelId: parsed.payload.channelId,
			blockedIssueId: parsed.payload.blockedIssueId,
			blockingIssueId: parsed.payload.blockingIssueId,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Smart Linkage] POST error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}

/**
 * DELETE /api/smart/linkage
 *
 * Removes a blocking relationship between two issues.
 * Body: { channelId, blockedIssueId, blockingIssueId }
 */
export async function DELETE(req: NextRequest) {
	try {
		const auth = await createAuthenticatedConvexClient();
		if (auth.error || !auth.convex) return auth.error;

		const parsed = await parseLinkagePayload(req);
		if (parsed.error || !parsed.payload) return parsed.error;

		await auth.convex.mutation(api.board.removeIssueBlockingRelationship, {
			channelId: parsed.payload.channelId,
			blockedIssueId: parsed.payload.blockedIssueId,
			blockingIssueId: parsed.payload.blockingIssueId,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("[Smart Linkage] DELETE error:", error);
		const message = error instanceof Error ? error.message : "Internal server error";
		return NextResponse.json({ error: message }, { status: 500 });
	}
}
