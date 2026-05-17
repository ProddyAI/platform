import { openai } from "@ai-sdk/openai";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { generateText } from "ai";
import { ConvexHttpClient } from "convex/browser";
import * as dotenv from "dotenv";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

// Load environment variables
dotenv.config();

function createConvexClient(): ConvexHttpClient {
	if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
		throw new Error("NEXT_PUBLIC_CONVEX_URL environment variable is required");
	}
	return new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL);
}

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			console.error("Missing OPENAI_API_KEY");
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		let requestData: {
			content?: string;
			title?: string;
			workspaceId?: Id<"workspaces">;
		} | null = null;
		try {
			requestData = (await req.json()) as {
				content?: string;
				title?: string;
				workspaceId?: Id<"workspaces">;
			};
		} catch (parseError) {
			console.error("Error parsing JSON:", parseError);
			return NextResponse.json(
				{ error: "Invalid JSON in request" },
				{ status: 400 }
			);
		}

		const { content, title, workspaceId } = requestData ?? {};

		if (!content) {
			console.error("Missing content in request");
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		// ─── Usage Limit Check ──────────────────────────────────────────────────
		const convex = workspaceId ? createConvexClient() : null;
		if (convex) {
			const token = await convexAuthNextjsToken();
			if (token) convex.setAuth(token);
		}

		if (workspaceId && convex) {
			try {
				const usageCheck = await convex.query(
					api.usageTracking.checkAIUsageLimitPublic,
					{
						workspaceId,
						featureType: "aiSummary", // Counting as summary per user's request for Usage page location
					}
				);

				if (!usageCheck.allowed) {
					return NextResponse.json(
						{
							error: `Usage limit reached. Your plan allows ${usageCheck.limit} AI actions per month.`,
						},
						{ status: 403 }
					);
				}
			} catch (err) {
				console.error(
					"[Smart Formatter] Workspace usage check failed:",
					err
				);
				return NextResponse.json(
					{
						error: "Usage check failed",
						message: "AI services are temporarily unavailable. Please try again.",
					},
					{ status: 503 }
				);
			}
		}

		// Prepare the formatting prompt
		const prompt = `You are an expert document formatter and editor. Your task is to improve the formatting, structure, and readability of the provided document while preserving all the original content and meaning.

Please format the following document by:

1. **Structure & Organization:**
   - Add clear headings and subheadings where appropriate
   - Organize content into logical sections
   - Use proper hierarchy (H1, H2, H3, etc.)
   - Add bullet points or numbered lists where suitable

2. **Content Enhancement:**
   - Fix grammar, spelling, and punctuation errors
   - Improve sentence structure and flow
   - Ensure consistent tone and style
   - Add emphasis (bold, italic) where appropriate

3. **Formatting Guidelines:**
   - Use markdown formatting
   - Maintain all original information
   - Don't add new content or change the meaning
   - Keep the same language as the original
   - Preserve any existing links, images, or special formatting

4. **Output Requirements:**
   - Return only the formatted content in markdown format
   - Do not include explanations or meta-commentary
   - Ensure the output is ready to be inserted directly into a document editor

${title ? `Document Title: ${title}\n\n` : ""}Original Content:
${content}

Formatted Content:`;

		try {
			const { text } = await generateText({
				model: openai("gpt-4o-mini"),
				prompt,
				temperature: 0.3, // Lower temperature for more consistent formatting
			});

			const formattedText = text.trim();

			// ─── Record Usage ──────────────────────────────────────────────────────
			if (workspaceId && convex) {
				try {
					await convex.mutation(api.usageTracking.recordAIRequestPublic, {
						workspaceId,
						featureType: "aiSummary",
					});
				} catch (trackErr) {
					console.warn("[Smart Formatter] Failed to record usage:", trackErr);
				}
			}

			return NextResponse.json({
				formattedContent: formattedText,
				originalLength: content.length,
				formattedLength: formattedText.length,
			});
		} catch (aiError) {
			console.error("[Smart Formatter] AI formatting failed:", aiError);

			// Return a fallback response
			return NextResponse.json(
				{
					error: "Formatting failed",
					message:
						"AI formatting service is temporarily unavailable. Please try again later.",
					fallback: true,
				},
				{ status: 503 }
			);
		}
	} catch (error) {
		console.error("[Smart Formatter] Unexpected error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
