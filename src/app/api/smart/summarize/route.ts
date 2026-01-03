import { google } from '@ai-sdk/google';
import { generateText } from 'ai';
import { format } from 'date-fns';
import * as dotenv from 'dotenv';
import { NextRequest, NextResponse } from 'next/server';

// Load environment variables
dotenv.config();

interface MessageData {
	body: string;
	authorName: string;
	creationTime: number;
}

// More efficient text extraction with memoization
const extractionCache = new Map<string, string>();

function extractTextFromRichText(body: string): string {
	if (typeof body !== 'string') {
		return String(body);
	}

	// Check cache first
	if (extractionCache.has(body)) {
		return extractionCache.get(body)!;
	}

	const trimmedBody = body.trim();
	let result = body;

	if (trimmedBody.startsWith('{') && trimmedBody.endsWith('}')) {
		try {
			const parsed = JSON.parse(trimmedBody);

			if (parsed && Array.isArray(parsed.ops)) {
				// Use a more efficient string building approach
				const textParts: string[] = [];

				for (const op of parsed.ops) {
					if (op && typeof op.insert === 'string') {
						textParts.push(op.insert);
					}
				}

				result = textParts
					.join('')
					.replace(/\\n|\\N|\n/g, ' ')
					.trim();
			}
		} catch (error) {
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
		.join('|');
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
		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return NextResponse.json(
				{ error: 'API key not configured' },
				{ status: 500 }
			);
		}

		let requestData;
		try {
			requestData = await req.json();
		} catch (parseError) {
			return NextResponse.json(
				{ error: 'Invalid JSON in request' },
				{ status: 400 }
			);
		}

		const { messages } = requestData;

		if (!messages || !Array.isArray(messages)) {
			return NextResponse.json(
				{ error: 'Invalid messages format' },
				{ status: 400 }
			);
		}

		if (messages.length === 0) {
			return NextResponse.json(
				{ error: 'No messages to summarize' },
				{ status: 400 }
			);
		}

		// Limit the number of messages to prevent overloading the AI model
		const limitedMessages =
			messages.length > MAX_MESSAGES
				? messages.slice(messages.length - MAX_MESSAGES)
				: messages;

		// Check cache first
		const cacheKey = generateCacheKey(limitedMessages);
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
					const timestamp = format(date, 'MM/dd/yyyy, h:mm a');
					return `[${timestamp}] ${msg.authorName}: ${plainText}`;
				} catch (error) {
					return '';
				}
			})
			.filter(Boolean)
			.join('\n');

		try {
			const { text } = await generateText({
				model: google('gemini-2.5-flash'),
				maxTokens: 300,
				messages: [
					{
						role: 'system',
						content: `You are an efficient text summarizer for group chat conversations.
Your task is to create a concise, informative summary of the conversation.
Focus on:
- Key topics and themes (most important)
- Decisions made or conclusions reached
- Action items and deadlines (if any)
- Important questions or unresolved issues

Guidelines:
- Format your response in Markdown
- Be extremely concise (3-4 sentences maximum)
- Use bullet points for clarity
- Use **bold** for important names, topics, and action items
- Use headings (## or ###) to organize by topic when appropriate
- Use > blockquotes for important quotes from the conversation
- Focus only on substantive content, ignore greetings and small talk
- Group by topic rather than chronology
- Return only the summary with no introductory phrases`,
					},
					{
						role: 'user',
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
			// More efficient fallback with markdown formatting
			const fallbackSummary =
				limitedMessages.length > 5
					? `### Summarization Failed\n\n${limitedMessages.length} messages selected. AI summarization failed. Try selecting fewer messages.`
					: `### Message Contents\n\n${limitedMessages
							.map((msg: MessageData) => {
								const plainText = extractTextFromRichText(msg.body);
								const formattedDate = format(
									new Date(msg.creationTime),
									"MMM d 'at' h:mm a"
								);
								return `**${msg.authorName}** (${formattedDate}):\n> ${plainText}`;
							})
							.join('\n\n')}`;

			return NextResponse.json({
				summary: fallbackSummary,
				note: 'AI summarization failed',
			});
		}
	} catch (error) {
		return NextResponse.json(
			{
				error: 'Internal server error',
				details: error instanceof Error ? error.message : 'Unknown error',
			},
			{ status: 500 }
		);
	}
}
