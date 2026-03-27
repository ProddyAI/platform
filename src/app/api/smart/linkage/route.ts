import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";
import { createMermaidDependencyDiagram } from "@/features/board/lib/dependency-diagram";

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

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isConvexArgumentValidationError(error: unknown): boolean {
	if (!(error instanceof Error)) {
		return false;
	}

	return (
		error.message.includes("ArgumentValidationError") ||
		error.message.includes("does not match validator") ||
		error.message.includes("Value does not match validator")
	);
}

function mapLinkageError(error: unknown) {
	if (isConvexArgumentValidationError(error)) {
		return { message: "Invalid linkage identifiers", status: 400 };
	}

	if (!(error instanceof Error)) {
		return { message: "Internal server error", status: 500 };
	}

	switch (error.message) {
		case "Not authenticated":
			return { message: error.message, status: 401 };
		case "Not a member of this workspace":
			return { message: error.message, status: 403 };
		case "Channel not found":
		case "Issue not found":
			return { message: error.message, status: 404 };
		case "An issue cannot block itself":
		case "Issues must belong to the same channel":
			return { message: error.message, status: 400 };
		default:
			if (error.message.startsWith("Circular dependency detected")) {
				return { message: error.message, status: 409 };
			}

			return { message: "Internal server error", status: 500 };
	}
}

function createAuthenticatedConvexClient() {
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

	if (!isRecord(body)) {
		return {
			error: NextResponse.json(
				{ error: "JSON body must be an object" },
				{ status: 400 }
			),
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
					error: "channelId, blockedIssueId, and blockingIssueId are required",
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
 * mermaid: ready-to-render "flowchart LR\n  ..." string, or "" if no edges
 */
export async function GET(req: NextRequest) {
	try {
		const auth = createAuthenticatedConvexClient();
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

		const mermaid = createMermaidDependencyDiagram(edges);

		return NextResponse.json({ edges, mermaid });
	} catch (error) {
		console.error("[Smart Linkage] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
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
		const auth = createAuthenticatedConvexClient();
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
		const mapped = mapLinkageError(error);
		return NextResponse.json(
			{ error: mapped.message },
			{ status: mapped.status }
		);
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
		const auth = createAuthenticatedConvexClient();
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
		const mapped = mapLinkageError(error);
		return NextResponse.json(
			{ error: mapped.message },
			{ status: mapped.status }
		);
	}
}
