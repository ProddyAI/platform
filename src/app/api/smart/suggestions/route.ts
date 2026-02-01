import { createOpenRouter } from '@openrouter/ai-sdk-provider';
import { generateText } from "ai";
import * as dotenv from "dotenv";
import { type NextRequest, NextResponse } from "next/server";

// Load environment variables
dotenv.config();

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY || '',
});

interface MessageData {
	id: string;
	body: string;
	authorName: string;
	creationTime: number;
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
			} else {
				console.log(
					"extractTextFromRichText - No ops array found in parsed JSON"
				);
			}
		} catch (error) {
			console.log("extractTextFromRichText - JSON parsing failed:", error);
			// If parsing fails, just use the original body
		}
	} else {
		console.log("extractTextFromRichText - Not JSON format, using as is");
	}

	// Store in cache for future use
	extractionCache.set(body, result);
	return result;
}

// Simple LRU cache for suggestions
const suggestionsCache = new Map<
	string,
	{ suggestions: string[]; timestamp: number }
>();
const CACHE_SIZE = 50; // Maximum number of cached suggestion sets
const CACHE_TTL = 1000 * 60 * 5; // 5 minutes in milliseconds

// Helper function to generate a cache key from messages and context (channel or member)
function generateCacheKey(
	messages: MessageData[],
	contextName?: string
): string {
	const messagesKey = messages
		.slice(-5) // Only use the last 5 messages for the cache key to avoid too much specificity
		.map((msg) => `${msg.id.substring(0, 8)}:${msg.authorName.substring(0, 5)}`)
		.join("|");

	return `${contextName || "unknown"}-${messagesKey}`;
}

// Helper function to maintain cache size
function pruneCache() {
	if (suggestionsCache.size <= CACHE_SIZE) return;

	// Remove oldest entries
	const entries = Array.from(suggestionsCache.entries());
	entries.sort((a, b) => a[1].timestamp - b[1].timestamp);

	// Remove expired entries and oldest entries until we're under the limit
	const now = Date.now();
	for (const [key, value] of entries) {
		if (
			now - value.timestamp > CACHE_TTL ||
			suggestionsCache.size > CACHE_SIZE
		) {
			suggestionsCache.delete(key);
		}
		if (suggestionsCache.size <= CACHE_SIZE) break;
	}
}

export async function POST(req: NextRequest) {
	try {
		// Check for API key
		if (!process.env.OPENROUTER_API_KEY) {
			console.error("Missing OPENROUTER_API_KEY");
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		// Parse request data
		let requestData;
		try {
			requestData = await req.json();
		} catch (_parseError) {
			return NextResponse.json(
				{ error: "Invalid JSON in request" },
				{ status: 400 }
			);
		}

		const { messages, channelName } = requestData;

		// Use channelName as the context - this API now only handles channel suggestions
		const contextName = channelName || "channel";

		// Validate messages
		if (!messages || !Array.isArray(messages)) {
			return NextResponse.json(
				{ error: "Invalid messages format" },
				{ status: 400 }
			);
		}

		// Handle empty messages case
		if (messages.length === 0) {
			return NextResponse.json({
				suggestions: [
					"Let's start a conversation!",
					"Hello team, how is everyone doing today?",
					"Any updates on our current projects?",
				],
				cached: false,
			});
		}

		// Validate message format
		const validMessages = messages.filter(
			(msg) =>
				msg &&
				typeof msg === "object" &&
				msg.body !== undefined &&
				msg.authorName &&
				typeof msg.authorName === "string"
		);

		if (validMessages.length === 0) {
			return NextResponse.json({
				suggestions: [
					"Let's get this conversation started!",
					"I'm ready to collaborate on this project.",
					"What are our priorities for today?",
				],
				cached: false,
			});
		}

		// Check cache first
		const cacheKey = generateCacheKey(validMessages, contextName);
		const cachedResult = suggestionsCache.get(cacheKey);

		if (cachedResult) {
			// Return cached result if it's not expired
			if (Date.now() - cachedResult.timestamp < CACHE_TTL) {
				return NextResponse.json({
					suggestions: cachedResult.suggestions,
					cached: true,
				});
			} else {
				// Remove expired entry
				suggestionsCache.delete(cacheKey);
			}
		}

		// Process messages
		const chatHistory = validMessages
			.map((msg: MessageData) => {
				try {
					// Handle both string and object body formats
					let plainText = "";
					if (typeof msg.body === "string") {
						plainText = extractTextFromRichText(msg.body);
					} else if (msg.body && typeof msg.body === "object") {
						// If body is already an object, convert to string first
						plainText = extractTextFromRichText(JSON.stringify(msg.body));
					} else {
						plainText = String(msg.body || "");
					}

					return `${msg.authorName}: ${plainText}`;
				} catch (_error) {
					return "";
				}
			})
			.filter(Boolean)
			.join("\n");

		// If chat history is too short, return default suggestions
		if (chatHistory.length < 10) {
			return NextResponse.json({
				suggestions: [
					"Let's start the discussion!",
					"I'd like to hear more about this topic.",
					"Could you share more details?",
				],
				cached: false,
			});
		}

		// Count actual messages (not empty lines)
		const messageCount = chatHistory
			.split("\n")
			.filter((line) => line.trim().length > 0).length;

		if (messageCount < 2) {
			return NextResponse.json({
				suggestions: [
					"Let's start a meaningful conversation!",
					"I'm interested in hearing your thoughts.",
					"What's on your agenda today?",
				],
				cached: false,
			});
		}

		try {
			const prompt = `You are an AI assistant that generates contextually relevant message suggestions for a channel conversation.
Your task is to analyze the recent conversation history and suggest 3 possible responses that the user might want to send next.

Guidelines:
- Generate exactly 3 suggestions, separated by a special marker "|||"
- Each suggestion should be a complete, standalone message (1-2 sentences)
- Make suggestions relevant to the conversation context
- Tailor suggestions to the channel topic
- Suggestions should be helpful, professional, and natural-sounding
- Vary the tone and purpose of suggestions (e.g., question, statement, action item)
- Keep suggestions concise (max 100 characters each)
- Do not include any explanations or commentary, just the 3 suggestions

Example output format:
Let's discuss this in our next meeting. ||| I've completed the task you assigned. ||| Could you provide more details about the requirements?`;

			const userContent = `Channel name: ${channelName || "General"}\n\nRecent conversation:\n${chatHistory}\n\nGenerate 3 contextually relevant message suggestions:`;

			let text;
			try {
				const response = await generateText({
					model: openrouter("google/gemini-2.5-flash"),
					messages: [
						{
							role: "system",
							content: prompt,
						},
						{
							role: "user",
							content: userContent,
						},
					],
					temperature: 0.7, // Add some randomness
				});

				text = response.text;
			} catch (error) {
				const aiError = error as Error;
				console.error("Error calling Gemini API:", aiError);
				// Return fallback suggestions instead of throwing
				return NextResponse.json({
					suggestions: [
						"Let's discuss this further.",
						"I have some thoughts on this topic.",
						"Could we schedule a meeting about this?",
					],
					cached: false,
					error: `Gemini API error: ${aiError.message || "Unknown error"}`,
				});
			}

			// Parse the suggestions from the response
			const suggestions = text
				.split("|||")
				.map((s) => s.trim())
				.filter(Boolean);

			// Ensure we have exactly 3 suggestions
			const finalSuggestions =
				suggestions.length >= 3
					? suggestions.slice(0, 3)
					: [
							...suggestions,
							"I'll look into this and get back to you.",
							"Thanks for sharing this information.",
							"Could we discuss this further in our next meeting?",
						].slice(0, 3);

			// Cache the result
			suggestionsCache.set(cacheKey, {
				suggestions: finalSuggestions,
				timestamp: Date.now(),
			});

			// Prune cache if needed
			pruneCache();

			return NextResponse.json({
				suggestions: finalSuggestions,
				cached: false,
			});
		} catch (_aiError) {
			// Fallback suggestions
			const fallbackSuggestions = [
				"I'll look into this and get back to you.",
				"Thanks for sharing this information.",
				"Could we discuss this further in our next meeting?",
			];

			return NextResponse.json({
				suggestions: fallbackSuggestions,
				note: "AI suggestion generation failed",
			});
		}
	} catch (error) {
		console.error("Error in suggestions route:", error);
		return NextResponse.json(
			{
				error: "Internal server error",
				details: error instanceof Error ? error.message : "Unknown error",
			},
			{ status: 500 }
		);
	}
}
