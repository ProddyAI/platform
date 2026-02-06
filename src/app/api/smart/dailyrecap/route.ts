import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import { format } from "date-fns";
import * as dotenv from "dotenv";
import { type NextRequest, NextResponse } from "next/server";

// Load environment variables
dotenv.config();

interface MessageData {
	id?: string;
	body: string;
	authorName: string;
	creationTime: number;
}

const openrouter = createOpenRouter({
	apiKey: process.env.OPENROUTER_API_KEY || "",
});

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

			// Check if this is a special message type (canvas, note, etc.)
			if (parsed && typeof parsed === "object") {
				if (
					parsed.type === "canvas" ||
					parsed.type === "canvas-live" ||
					parsed.type === "canvas-export"
				) {
					result = `📐 Canvas: ${parsed.canvasName || "Untitled Canvas"}`;
				} else if (
					parsed.type === "note" ||
					parsed.type === "note-live" ||
					parsed.type === "note-export"
				) {
					result = `📝 Note: ${parsed.noteTitle || "Untitled Note"}`;
				} else if (parsed && Array.isArray(parsed.ops)) {
					// Handle Quill Delta format
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
			}
		} catch (_error) {
			// If parsing fails, just use the original body
		}
	}

	// Store in cache for future use
	extractionCache.set(body, result);
	return result;
}

// Maximum number of messages to process for daily recap
const MAX_MESSAGES = 200;

// Simple LRU cache for recaps
const recapCache = new Map<string, { recap: string; timestamp: number }>();
const CACHE_SIZE = 50; // Maximum number of cached recaps
const CACHE_TTL = 1000 * 60 * 60 * 24; // 24 hours in milliseconds

// Helper function to generate a cache key from messages
function generateCacheKey(messages: MessageData[], date: string): string {
	return `${date}-${messages.length}`;
}

// Helper function to maintain cache size
function pruneCache() {
	if (recapCache.size <= CACHE_SIZE) return;

	// Remove oldest entries
	const entries = Array.from(recapCache.entries());
	entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

	// Remove expired entries and oldest entries until we're under the limit
	const now = Date.now();
	for (const [key, value] of entries) {
		if (now - value.timestamp > CACHE_TTL || recapCache.size > CACHE_SIZE) {
			recapCache.delete(key);
		}
		if (recapCache.size <= CACHE_SIZE) break;
	}
}

export async function POST(req: NextRequest) {
	try {
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			console.error("Missing GOOGLE_GENERATIVE_AI_API_KEY");
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		let requestData;
		try {
			requestData = await req.json();
		} catch (parseError) {
			console.error("Error parsing JSON:", parseError);
			return NextResponse.json(
				{ error: "Invalid JSON in request" },
				{ status: 400 }
			);
		}

		const { messages, date, channelName } = requestData;

		if (!messages || !Array.isArray(messages)) {
			console.error("Invalid messages format:", messages);
			return NextResponse.json(
				{ error: "Invalid messages format" },
				{ status: 400 }
			);
		}

		if (messages.length === 0) {
			return NextResponse.json(
				{ error: "No messages to recap" },
				{ status: 400 }
			);
		}

		if (!date) {
			return NextResponse.json({ error: "Date is required" }, { status: 400 });
		}

		// Limit the number of messages to prevent overloading the AI model
		const limitedMessages =
			messages.length > MAX_MESSAGES
				? messages.slice(messages.length - MAX_MESSAGES)
				: messages;

		// Check cache first
		const cacheKey = generateCacheKey(limitedMessages, date);
		const cachedResult = recapCache.get(cacheKey);

		if (cachedResult) {
			// Return cached result if it's not expired
			if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
				return NextResponse.json({ recap: cachedResult.recap, cached: true });
			} else {
				// Remove expired entry
				recapCache.delete(cacheKey);
			}
		}

		// Process messages more efficiently
		const chatHistory = limitedMessages
			.map((msg: MessageData) => {
				try {
					const plainText = extractTextFromRichText(msg.body);
					const timestamp = format(new Date(msg.creationTime), "h:mm a");
					return `[${timestamp}] ${msg.authorName}: ${plainText}`;
				} catch (_error) {
					return "";
				}
			})
			.filter(Boolean)
			.join("\n");

		try {
			const { text } = await generateText({
				model: openrouter("google/gemini-2.5-flash"),
				messages: [
					{
						role: "system",
						content: `You are an expert daily conversation recap tool that creates comprehensive, well-structured summaries of chat conversations.

Your task is to create a detailed daily recap of the conversation for the date: ${date}.
${channelName ? `This conversation took place in the channel: ${channelName}.` : ""}

Guidelines:
- Format your response in Markdown with clear section headings
- Begin with a concise executive summary (2-3 sentences)
- Include these sections:
  1. Key Topics & Discussions
  2. Decisions & Conclusions
  3. Action Items & Assignments (with owners if mentioned)
  4. Questions & Open Issues
  5. Important Links & Resources shared
- Use bullet points for clarity
- Use **bold** for important names, topics, and action items
- Include meaningful quotes from the conversation using > blockquotes
- Group by topic rather than chronology
- Maintain a professional, neutral tone
- If appropriate, include a "Next Steps" section at the end

Your recap should be comprehensive but well-organized, making it easy for someone who missed the day's conversation to quickly understand what happened.`,
					},
					{
						role: "user",
						content: `Here are all the messages from ${date}:\n\n${chatHistory}\n\nPlease provide a comprehensive daily recap.`,
					},
				],
				temperature: 0.2, // Lower temperature for more consistent output
			});

			// Cache the result
			recapCache.set(cacheKey, {
				recap: text,
				timestamp: Date.now(),
			});

			// Prune cache if needed
			pruneCache();

			return NextResponse.json({ recap: text, date });
		} catch (_aiError) {
			// More efficient fallback with markdown formatting
			const fallbackRecap =
				limitedMessages.length > 5
					? `### Daily Recap Failed\n\n${limitedMessages.length} messages from ${date}. AI recap generation failed. Try again later.`
					: `### Messages from ${date}\n\n${limitedMessages
							.map((msg: MessageData) => {
								const plainText = extractTextFromRichText(msg.body);
								const formattedTime = format(
									new Date(msg.creationTime),
									"h:mm a"
								);
								return `**${msg.authorName}** (${formattedTime}):\n> ${plainText}`;
							})
							.join("\n\n")}`;

			return NextResponse.json({
				recap: fallbackRecap,
				date,
				note: "AI recap generation failed",
			});
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
