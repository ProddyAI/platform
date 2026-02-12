import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { format } from "date-fns";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

interface MessageData {
	body: string;
	authorName: string;
	creationTime: number;
}

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY || "",
});

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

function normalizeChannelName(name: string) {
	return name.trim().toLowerCase().replace(/\s+/g, "-");
}

function normalizeChannelQuery(raw: string) {
	let s = raw.trim().toLowerCase();
	if (s.startsWith("#")) s = s.slice(1);
	s = s.replace(/\bchannel\b/g, "").trim();
	s = s.replace(/[\s_]+/g, "-");
	s = s.replace(/[^a-z0-9-]/g, "");
	s = s.replace(/-+/g, "-");
	s = s.replace(/^-+|-+$/g, "");
	return s;
}

async function fetchRecentChannelMessages(opts: {
	workspaceId: Id<"workspaces">;
	channelId?: Id<"channels">;
	channel?: string;
	limit: number;
}): Promise<{ resolvedChannelName: string; messages: MessageData[] }> {
	const convex = createConvexClient();

	// Pass auth through to Convex so channel membership checks work.
	try {
		const token = convexAuthNextjsToken();
		if (token) {
			convex.setAuth(token);
		} else if (isAuthenticatedNextjs()) {
			console.warn(
				"[Smart Summarize] Authenticated session but no Convex token found"
			);
		}
	} catch (err) {
		if (isAuthenticatedNextjs()) {
			console.warn(
				"[Smart Summarize] Failed to read Convex auth token from request",
				err
			);
		}
	}

	let resolvedChannelId: Id<"channels"> | undefined = opts.channelId;
	let resolvedChannelName = "";

	if (!resolvedChannelId) {
		const channelQuery = String(opts.channel ?? "").trim();
		if (!channelQuery) {
			throw new Error("channel or channelId is required");
		}

		const channels = await convex.query(api.channels.get, {
			workspaceId: opts.workspaceId,
		});

		if (!Array.isArray(channels) || channels.length === 0) {
			throw new Error("No channels found for workspace (or no access)");
		}

		const querySlug = normalizeChannelQuery(channelQuery);
		let best: { id: Id<"channels">; name: string; score: number } | null = null;

		for (const ch of channels as Array<{ _id: Id<"channels">; name: string }>) {
			const chSlug = normalizeChannelName(String(ch?.name ?? ""));
			const score =
				chSlug === querySlug ? 1000 : chSlug.includes(querySlug) ? 600 : 0;
			if (!best || score > best.score) {
				best = { id: ch._id, name: ch.name, score };
			}
		}

		if (!best || best.score < 500) {
			throw new Error(`Channel not found: ${channelQuery}`);
		}

		resolvedChannelId = best.id;
		resolvedChannelName = best.name;
	} else {
		// If caller gave an ID, we still attempt to resolve name for nicer output.
		try {
			const channels = await convex.query(api.channels.get, {
				workspaceId: opts.workspaceId,
			});
			const found = (
				channels as Array<{ _id: Id<"channels">; name: string }>
			).find((c) => String(c?._id) === String(resolvedChannelId));
			resolvedChannelName = found?.name ?? "";
		} catch {
			resolvedChannelName = "";
		}
	}

	const messages = await convex.query(api.messages.getRecentChannelMessages, {
		channelId: resolvedChannelId,
		limit: opts.limit,
	});

	return {
		resolvedChannelName:
			resolvedChannelName ||
			String(opts.channel ?? "")
				.replace(/^#/, "")
				.trim(),
		messages: (messages as MessageData[]) ?? [],
	};
}

// More efficient text extraction with memoization
const extractionCache = new Map<string, string>();

function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") {
		return String(body);
	}

	// Check cache first
	if (extractionCache.has(body)) {
		return extractionCache.get(body)!;
	}

	const trimmedBody = body.trim();
	let result = body;

	if (trimmedBody.startsWith("{") && trimmedBody.endsWith("}")) {
		try {
			const parsed = JSON.parse(trimmedBody);

			if (parsed && Array.isArray(parsed.ops)) {
				// Use a more efficient string building approach
				const textParts: string[] = [];

				for (const op of parsed.ops) {
					if (op && typeof op.insert === "string") {
						textParts.push(op.insert);
					}
				}

				result = textParts
					.join("")
					.replace(/\\n|\\N|\n/g, " ")
					.trim();
			}
		} catch (_error) {
			// If parsing fails, just use the original body
		}
	}

	// Store in cache for future use
	extractionCache.set(body, result);
	return result;
}

// Maximum number of messages to process for summarization
const MAX_MESSAGES = 100;

// Simple LRU cache for summaries
const summaryCache = new Map<string, { summary: string; timestamp: number }>();
const CACHE_SIZE = 50; // Maximum number of cached summaries
const CACHE_TTL = 1000 * 60 * 60; // 1 hour in milliseconds

// Helper function to generate a cache key from messages
function generateCacheKey(messages: MessageData[]): string {
	return messages
		.map(
			(msg) =>
				`${msg.authorName}:${msg.creationTime}:${msg.body.substring(0, 50)}`
		)
		.join("|");
}

// Helper function to maintain cache size
function pruneCache() {
	if (summaryCache.size <= CACHE_SIZE) return;

	// Remove oldest entries
	const entries = Array.from(summaryCache.entries());
	entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

	// Remove expired entries and oldest entries until we're under the limit
	const now = Date.now();
	for (const [key, value] of entries) {
		if (now - value.timestamp > CACHE_TTL || summaryCache.size > CACHE_SIZE) {
			summaryCache.delete(key);
		}
		if (summaryCache.size <= CACHE_SIZE) break;
	}
}

export async function POST(req: NextRequest) {
	try {
		let requestData;
		try {
			requestData = await req.json();
		} catch (_parseError) {
			return NextResponse.json(
				{ error: "Invalid JSON in request" },
				{ status: 400 }
			);
		}

		let messages: MessageData[] | null = null;
		let channelLabel: string | null = null;

		// Back-compat: accept explicit messages.
		if (Array.isArray((requestData as any)?.messages)) {
			messages = (requestData as any).messages as MessageData[];
		}

		// New mode: accept workspaceId + channel / channelId and fetch from DB.
		if (!messages) {
			const workspaceId = (requestData as any)?.workspaceId as
				| Id<"workspaces">
				| undefined;
			const channel = (requestData as any)?.channel as string | undefined;
			const channelId = (requestData as any)?.channelId as
				| Id<"channels">
				| undefined;
			const limitRaw = (requestData as any)?.limit;
			const limit =
				typeof limitRaw === "number" && Number.isFinite(limitRaw)
					? Math.max(1, Math.min(MAX_MESSAGES, Math.floor(limitRaw)))
					: MAX_MESSAGES;

			if (!workspaceId) {
				return NextResponse.json(
					{ error: "Either messages[] or workspaceId is required" },
					{ status: 400 }
				);
			}

			try {
				const fetched = await fetchRecentChannelMessages({
					workspaceId,
					channel,
					channelId,
					limit,
				});
				messages = fetched.messages;
				channelLabel = fetched.resolvedChannelName
					? `#${fetched.resolvedChannelName}`
					: null;
			} catch (err) {
				return NextResponse.json(
					{
						error:
							err instanceof Error
								? err.message
								: "Failed to fetch channel messages",
					},
					{ status: 404 }
				);
			}
		}

		if (!messages || messages.length === 0) {
			return NextResponse.json(
				{ error: "No messages found to summarize" },
				{ status: 404 }
			);
		}

		// Limit the number of messages to prevent overloading the AI model
		const limitedMessages =
			messages.length > MAX_MESSAGES
				? messages.slice(messages.length - MAX_MESSAGES)
				: messages;

		// Check cache first
		const cacheKey = `${channelLabel ?? "messages"}::${generateCacheKey(limitedMessages)}`;
		const cachedResult = summaryCache.get(cacheKey);

		if (cachedResult) {
			// Return cached result if it's not expired
			if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
				return NextResponse.json({
					summary: cachedResult.summary,
					cached: true,
				});
			} else {
				// Remove expired entry
				summaryCache.delete(cacheKey);
			}
		}

		// Process messages more efficiently
		const chatHistory = limitedMessages
			.map((msg: MessageData) => {
				try {
					const plainText = extractTextFromRichText(msg.body);
					const date = new Date(msg.creationTime);
					const timestamp = format(date, "MM/dd/yyyy, h:mm a");
					return `[${timestamp}] ${msg.authorName}: ${plainText}`;
				} catch (_error) {
					return "";
				}
			})
			.filter(Boolean)
			.join("\n");

		try {
			const { text } = await generateText({
				model: openrouter("openai/gpt-5-mini"),
				messages: [
					{
						role: "system",
						content: `You summarize workspace chat for a user.

Task:
- Create a concise, informative recap grounded ONLY in the provided messages.
- Focus on concrete updates, decisions, blockers/risks, owners, and next actions.

Strict rules:
- Do NOT quote messages verbatim and do NOT include any continuous 5+ words copied from the messages.
- Do NOT use blockquotes.
- Avoid vague filler.
- If something is unknown, say "Not specified".

Output format (Markdown, no intro text):
## Summary${channelLabel ? ` — ${channelLabel}` : ""}
- ...

## Action items
- ... (Owner: @Name, Due: ...)

## Decisions
- ...

## Risks / blockers
- ...`,
					},
					{
						role: "user",
						content: chatHistory,
					},
				],
			});

			// Cache the result
			summaryCache.set(cacheKey, {
				summary: text,
				timestamp: Date.now(),
			});

			// Prune cache if needed
			pruneCache();

			return NextResponse.json({ summary: text });
		} catch (aiError) {
			console.error("[Smart Summarize] AI summarization failed:", aiError);
			return NextResponse.json(
				{
					error:
						"Summarization failed. Verify the channel is accessible and the AI key/model are configured.",
				},
				{ status: 502 }
			);
		}
	} catch (error) {
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
