import { openai } from "@ai-sdk/openai";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { generateObject } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export const dynamic = "force-dynamic";

const suggestionSchema = z.object({
	suggestions: z.array(
		z.object({
			issueId: z.string(),
			reason: z.string(),
			confidence: z.enum(["low", "medium", "high"]),
		})
	),
});

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
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
		console.warn(
			"[Smart Linkage Suggestions] Failed to read Convex auth token",
			error
		);
		return {
			error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
			convex: null,
		};
	}
}

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "OPENAI_API_KEY is not configured" },
				{ status: 500 }
			);
		}

		const auth = createAuthenticatedConvexClient();
		if (auth.error || !auth.convex) return auth.error;

		const body = await req.json().catch(() => null);
		const channelId =
			typeof body?.channelId === "string" ? body.channelId.trim() : "";
		const issueId =
			typeof body?.issueId === "string" ? body.issueId.trim() : "";

		if (!channelId || !issueId) {
			return NextResponse.json(
				{ error: "channelId and issueId are required" },
				{ status: 400 }
			);
		}

		const [issue, allIssues, edges] = await Promise.all([
			auth.convex.query(api.board.getIssueDetails, {
				issueId: issueId as Id<"issues">,
			}),
			auth.convex.query(api.board.getAllIssuesForBlocking, {
				channelId: channelId as Id<"channels">,
			}),
			auth.convex.query(api.board.getChannelBlockingEdges, {
				channelId: channelId as Id<"channels">,
			}),
		]);

		if (!issue) {
			return NextResponse.json({ error: "Issue not found" }, { status: 404 });
		}

		const relatedIssueIds = new Set<string>();
		for (const edge of edges) {
			if (String(edge.blockingIssueId) === issueId) {
				relatedIssueIds.add(String(edge.blockedIssueId));
			}
			if (String(edge.blockedIssueId) === issueId) {
				relatedIssueIds.add(String(edge.blockingIssueId));
			}
		}

		const candidateIssues = allIssues
			.filter((candidate) => {
				const candidateId = String(candidate._id);
				return candidateId !== issueId && !relatedIssueIds.has(candidateId);
			})
			.slice(0, 40);

		if (candidateIssues.length === 0) {
			return NextResponse.json({ suggestions: [] });
		}

		const currentIssueContext = [
			`Current issue title: ${issue.title}`,
			`Current issue description: ${issue.description || "None"}`,
			`Current issue priority: ${issue.priority || "no_priority"}`,
			`Existing relationship count in channel: ${edges.length}`,
		].join("\n");

		const candidateContext = candidateIssues
			.map((candidate, index) => {
				const description =
					candidate.description?.trim().slice(0, 220) || "No description";
				return `${index + 1}. id=${candidate._id}\ntitle=${candidate.title}\ndescription=${description}`;
			})
			.join("\n\n");

		const { object } = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: suggestionSchema,
			temperature: 0.2,
			system: `You suggest issue dependency relationships for a project board.

Pick up to 3 candidate issues that the CURRENT issue is likely blocking.
Only suggest issues from the provided candidate list.
Do not invent issue IDs.
Prefer suggestions where sequencing or dependency is clear from the titles/descriptions.
If there is weak evidence, return fewer suggestions or an empty list.
Keep reasons concise and practical.`,
			prompt: `${currentIssueContext}

Candidate issues the current issue could block:
${candidateContext}`,
		});

		const candidateMap = new Map(
			candidateIssues.map((candidate) => [String(candidate._id), candidate])
		);

		const suggestions = object.suggestions
			.map((suggestion) => {
				const match = candidateMap.get(String(suggestion.issueId));
				if (!match) return null;
				return {
					issueId: String(match._id),
					title: match.title,
					reason: suggestion.reason.trim(),
					confidence: suggestion.confidence,
				};
			})
			.filter((suggestion): suggestion is NonNullable<typeof suggestion> =>
				Boolean(suggestion)
			)
			.slice(0, 3);

		return NextResponse.json({ suggestions });
	} catch (error) {
		console.error("[Smart Linkage Suggestions] Error:", error);
		return NextResponse.json(
			{ error: "Failed to generate suggestions" },
			{ status: 500 }
		);
	}
}
