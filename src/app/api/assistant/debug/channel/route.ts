import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { ConvexHttpClient } from "convex/browser";
import { NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const dynamic = "force-dynamic";

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		return await runDebugLookup({
			workspaceId: body?.workspaceId as Id<"workspaces"> | undefined,
			channel:
				typeof body?.channel === "string" ? body.channel.trim() : "",
			limit:
				typeof body?.limit === "number" && Number.isFinite(body.limit)
					? body.limit
					: 20,
		});
	} catch (error) {
		console.error("[Assistant Debug Channel] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

export async function GET(req: NextRequest) {
	try {
		const workspaceId = req.nextUrl.searchParams.get(
			"workspaceId"
		) as Id<"workspaces"> | null;
		const channel = req.nextUrl.searchParams.get("channel")?.trim() ?? "";
		const limitParam = Number(req.nextUrl.searchParams.get("limit") ?? "20");

		return await runDebugLookup({
			workspaceId: workspaceId ?? undefined,
			channel,
			limit: Number.isFinite(limitParam) ? limitParam : 20,
		});
	} catch (error) {
		console.error("[Assistant Debug Channel] Error:", error);
		return NextResponse.json(
			{
				success: false,
				error: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}

async function runDebugLookup(params: {
	workspaceId?: Id<"workspaces">;
	channel: string;
	limit: number;
}) {
	const convex = createConvexClient();

	try {
		const token = convexAuthNextjsToken();
		if (token) {
			convex.setAuth(token);
		}
	} catch (error) {
		if (isAuthenticatedNextjs()) {
			console.warn(
				"[Assistant Debug Channel] Failed to attach Convex auth token",
				error
			);
		}
	}

	if (!params.workspaceId || !params.channel) {
		return NextResponse.json(
			{ error: "workspaceId and channel are required" },
			{ status: 400 }
		);
	}

	const normalizedQuery = params.channel.replace(/^#/, "");
	const search = await convex.query(api.assistantTools.searchChannels, {
		workspaceId: params.workspaceId,
		query: normalizedQuery,
	});

	const channels = Array.isArray(search?.channels) ? search.channels : [];
	const exactMatch =
		channels.find(
			(channel) => channel.name.toLowerCase() === normalizedQuery.toLowerCase()
		) ?? channels[0];

	if (!exactMatch) {
		return NextResponse.json({
			success: true,
			workspaceId: params.workspaceId,
			channelQuery: params.channel,
			resolvedChannel: null,
			search,
			debug: null,
		});
	}

	const debug = await convex.query(api.assistantTools.getChannelDebug, {
		workspaceId: params.workspaceId,
		channelId: exactMatch.id as Id<"channels">,
		limit: params.limit,
	});

	return NextResponse.json({
		success: true,
		workspaceId: params.workspaceId,
		channelQuery: params.channel,
		resolvedChannel: exactMatch,
		search,
		debug,
	});
}
