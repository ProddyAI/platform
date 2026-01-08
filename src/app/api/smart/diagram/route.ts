import { google } from "@ai-sdk/google";
import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

const MAX_PROMPT_LENGTH = 4000;
const GENERATE_TIMEOUT_MS = 30_000;

type RateLimitState = {
	timestamps: number[];
};

// Simple in-memory rate limiter (best-effort; may reset between serverless invocations).
const rateLimitByClient = new Map<string, RateLimitState>();
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 10;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function getClientId(req: NextRequest, userId: string | null): string {
	if (userId) return `user:${userId}`;
	const forwardedFor = req.headers.get("x-forwarded-for");
	const ip = forwardedFor?.split(",")[0]?.trim();
	return `ip:${ip || "unknown"}`;
}

function enforceRateLimit(clientId: string): boolean {
	const now = Date.now();
	const existing = rateLimitByClient.get(clientId);
	const timestamps = existing?.timestamps ?? [];
	const recent = timestamps.filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
	recent.push(now);
	rateLimitByClient.set(clientId, { timestamps: recent });
	return recent.length <= RATE_LIMIT_MAX_REQUESTS;
}

let cachedConvexClient: ConvexHttpClient | null = null;
function getConvexClient(): ConvexHttpClient {
	if (!cachedConvexClient) {
		if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
			throw new Error(
				"NEXT_PUBLIC_CONVEX_URL environment variable is required"
			);
		}
		cachedConvexClient = new ConvexHttpClient(
			process.env.NEXT_PUBLIC_CONVEX_URL
		);
	}
	return cachedConvexClient;
}

async function generateTextWithTimeout(
	args: Parameters<typeof generateText>[0]
) {
	return await Promise.race([
		generateText(args),
		new Promise<never>((_resolve, reject) => {
			setTimeout(
				() => reject(new Error("AI request timed out")),
				GENERATE_TIMEOUT_MS
			);
		}),
	]);
}

export async function POST(req: NextRequest) {
	try {
		if (!isAuthenticatedNextjs()) {
			console.warn("[Smart Diagram] Unauthorized request");
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		if (!process.env.GOOGLE_GENERATIVE_AI_API_KEY) {
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		let userId: string | null = null;
		try {
			const convex = getConvexClient();
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			}
			const maybeUser: unknown = await convex.query(api.users.current, {});
			if (isRecord(maybeUser) && typeof maybeUser._id === "string") {
				userId = maybeUser._id;
			}
		} catch (err) {
			console.warn(
				"[Smart Diagram] Failed to resolve user for rate limit",
				err
			);
		}

		const clientId = getClientId(req, userId);
		if (!enforceRateLimit(clientId)) {
			console.warn("[Smart Diagram] Rate limited", { clientId });
			return NextResponse.json({ error: "Too Many Requests" }, { status: 429 });
		}

		const body = await req.json().catch(() => null);
		const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
		if (prompt.length > MAX_PROMPT_LENGTH) {
			return NextResponse.json(
				{ error: `Prompt too long (max ${MAX_PROMPT_LENGTH} characters)` },
				{ status: 400 }
			);
		}

		if (!prompt) {
			return NextResponse.json(
				{ error: "Prompt is required" },
				{ status: 400 }
			);
		}

		const model = google("gemini-2.5-flash");

		const systemPrompt = `You are a diagram generator.

Given a natural-language description, output ONLY a valid Mermaid diagram definition.

Rules:
- Output Mermaid ONLY. No markdown fences. No explanations.
- Prefer flowcharts unless the user asks for sequence/state specifically.
- Keep diagrams readable: use short node labels, clear success/failure paths.
- Use Mermaid v10+ compatible syntax.

Examples of valid outputs:
flowchart TD
  A([Start]) --> B[Enter credentials]
  B --> C{Valid?}
  C -->|Yes| D[Dashboard]
  C -->|No| E[Error / Retry]

sequenceDiagram
  participant U as User
  participant S as Server
  U->>S: Login request
  S-->>U: Success/Failure
`;

		const fullPrompt = `${systemPrompt}

User request:
${prompt}

Mermaid:`;

		const { text } = await generateTextWithTimeout({
			model,
			prompt: fullPrompt,
			temperature: 0.2,
			maxTokens: 1200,
		});

		const mermaid = (text || "").trim();

		if (!mermaid) {
			return NextResponse.json(
				{ error: "Empty Mermaid response" },
				{ status: 502 }
			);
		}

		return NextResponse.json({ mermaid });
	} catch (error) {
		console.error("[Smart Diagram] Unexpected error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
