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

interface ResolvedSuggestion {
	issueId: string;
	title: string;
	reason: string;
	confidence: "low" | "medium" | "high";
}

interface CachedSuggestionsEntry {
	suggestions: ResolvedSuggestion[];
	timestamp: number;
}

const confidenceRank = {
	high: 3,
	medium: 2,
	low: 1,
} as const;

const linkageSuggestionsCache = new Map<string, CachedSuggestionsEntry>();
const LINKAGE_SUGGESTIONS_CACHE_TTL = 1000 * 60;
const LINKAGE_SUGGESTIONS_CACHE_SIZE = 100;

function pruneLinkageSuggestionsCache() {
	if (linkageSuggestionsCache.size <= LINKAGE_SUGGESTIONS_CACHE_SIZE) {
		return;
	}

	const entries = Array.from(linkageSuggestionsCache.entries());
	entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

	const now = Date.now();
	for (const [key, value] of entries) {
		if (
			now - value.timestamp > LINKAGE_SUGGESTIONS_CACHE_TTL ||
			linkageSuggestionsCache.size > LINKAGE_SUGGESTIONS_CACHE_SIZE
		) {
			linkageSuggestionsCache.delete(key);
		}

		if (linkageSuggestionsCache.size <= LINKAGE_SUGGESTIONS_CACHE_SIZE) {
			break;
		}
	}
}

function getCachedLinkageSuggestions(cacheKey: string) {
	const cached = linkageSuggestionsCache.get(cacheKey);
	if (!cached) {
		return null;
	}

	if (Date.now() - cached.timestamp > LINKAGE_SUGGESTIONS_CACHE_TTL) {
		linkageSuggestionsCache.delete(cacheKey);
		return null;
	}

	return cached.suggestions;
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

function truncatePromptText(value: string | undefined, maxLength = 220) {
	const trimmed = value?.trim();
	if (!trimmed) {
		return "None";
	}

	return trimmed.length > maxLength
		? `${trimmed.slice(0, maxLength - 1)}…`
		: trimmed;
}

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

		let issue;
		try {
			issue = await auth.convex.query(api.board.getIssueDetails, {
				issueId: issueId as Id<"issues">,
			});
		} catch (error) {
			if (isConvexArgumentValidationError(error)) {
				return NextResponse.json({ error: "invalid issueId" }, { status: 400 });
			}
			throw error;
		}

		if (!issue) {
			return NextResponse.json({ error: "Issue not found" }, { status: 404 });
		}

		if (String(issue.channelId) !== channelId) {
			return NextResponse.json(
				{ error: "Issue does not belong to the requested channel" },
				{ status: 400 }
			);
		}

		const [allIssues, edges] = await Promise.all([
			auth.convex.query(api.board.getAllIssuesForBlocking, {
				channelId: channelId as Id<"channels">,
			}),
			auth.convex.query(api.board.getChannelBlockingEdges, {
				channelId: channelId as Id<"channels">,
			}),
		]);

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

		const cacheKey = `${channelId}:${issueId}`;
		const cachedSuggestions = getCachedLinkageSuggestions(cacheKey);

		if (cachedSuggestions) {
			const candidateMap = new Map(
				candidateIssues.map((candidate) => [String(candidate._id), candidate])
			);
			const suggestions = cachedSuggestions
				.filter((suggestion) => candidateMap.has(suggestion.issueId))
				.slice(0, 3);
			return NextResponse.json({ suggestions });
		}

		const currentIssueContext = [
			`Current issue title: ${issue.title}`,
			`Current issue description: ${truncatePromptText(issue.description)}`,
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
			.reduce<ResolvedSuggestion[]>((deduped, suggestion) => {
				const existingIndex = deduped.findIndex(
					(existing) => existing.issueId === suggestion.issueId
				);

				if (existingIndex === -1) {
					deduped.push(suggestion);
					return deduped;
				}

				if (
					confidenceRank[suggestion.confidence] >
					confidenceRank[deduped[existingIndex].confidence]
				) {
					deduped[existingIndex] = suggestion;
				}

				return deduped;
			}, [])
			.slice(0, 3);

		linkageSuggestionsCache.set(cacheKey, {
			suggestions,
			timestamp: Date.now(),
		});
		pruneLinkageSuggestionsCache();

		return NextResponse.json({ suggestions });
	} catch (error) {
		console.error("[Smart Linkage Suggestions] Error:", error);
		return NextResponse.json(
			{ error: "Failed to generate suggestions" },
			{ status: 500 }
		);
	}
}
