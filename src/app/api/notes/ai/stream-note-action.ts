import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared configuration
// ---------------------------------------------------------------------------

/** Maximum content size: 50 000 chars (~12 500 tokens) */
export const MAX_CONTENT_LENGTH = 50_000;

export const RequestSchema = z.object({
	content: z
		.string()
		.min(1, "Content is required")
		.max(
			MAX_CONTENT_LENGTH,
			`Content exceeds maximum allowed length of ${MAX_CONTENT_LENGTH} characters`
		),
});

// In-memory rate limiter — replace with Upstash for multi-instance deployments
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

export function checkRateLimit(ip: string): boolean {
	const now = Date.now();
	const entry = rateLimitMap.get(ip);

	if (!entry || now > entry.resetAt) {
		rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_WINDOW_MS });
		return true;
	}

	if (entry.count >= RATE_LIMIT) return false;

	entry.count += 1;
	return true;
}

// ---------------------------------------------------------------------------
// Core helper — eliminates duplication across all four AI routes
// ---------------------------------------------------------------------------

interface StreamNoteActionOptions {
	/** System prompt describing what the AI should do */
	systemPrompt: string;
	/** User-facing message prefix, e.g. "Clean up the following note:" */
	userPromptPrefix: string;
	/** Sampling temperature — lower = more deterministic */
	temperature?: number;
	/** Label used in error log, e.g. "Clean" */
	actionLabel: string;
}

/**
 * Validates the request, enforces rate limiting, calls OpenAI with streamText,
 * and returns a streaming text response — or an appropriate error response.
 *
 * All four Notes AI routes delegate to this helper so shared logic
 * (Zod validation, size guard, rate limiting, error logging) lives in one place.
 */
export async function streamNoteAction(
	req: NextRequest,
	{
		systemPrompt,
		userPromptPrefix,
		temperature = 0.4,
		actionLabel,
	}: StreamNoteActionOptions
): Promise<NextResponse | Response> {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		// Rate limiting
		const ip =
			req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
		if (!checkRateLimit(ip)) {
			return NextResponse.json(
				{ error: "Too many requests. Please wait before trying again." },
				{ status: 429 }
			);
		}

		// Validated input — no unsafe type assertion
		const body = await req.json().catch(() => null);
		const parsed = RequestSchema.safeParse(body);

		if (!parsed.success) {
			return NextResponse.json(
				{ error: parsed.error.errors[0]?.message ?? "Invalid request" },
				{ status: 400 }
			);
		}

		const { content } = parsed.data;

		const result = streamText({
			model: openai("gpt-4o-mini"),
			system: systemPrompt,
			messages: [
				{
					role: "user",
					content: `${userPromptPrefix}\n\n${content}`,
				},
			],
			temperature,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		// Production-safe: no PII or stack traces exposed to clients
		process.stderr.write(
			`[Notes AI ${actionLabel}] ${error instanceof Error ? error.message : String(error)}\n`
		);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
