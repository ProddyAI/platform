import { openai } from "@ai-sdk/openai";
import { streamText } from "ai";
import { type NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "API key not configured" },
				{ status: 500 }
			);
		}

		const { content } = (await req.json()) as { content?: string };

		if (!content?.trim()) {
			return NextResponse.json(
				{ error: "Content is required" },
				{ status: 400 }
			);
		}

		const result = streamText({
			model: openai("gpt-4o-mini"),
			system:
				"You are an expert editor. Fix grammar and improve clarity of the note. Maintain the original meaning and structure. Return only the cleaned-up version in markdown format — no explanations, no meta-commentary.",
			messages: [
				{
					role: "user",
					content: `Clean up the following note:\n\n${content}`,
				},
			],
			temperature: 0.3,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[Notes AI Clean] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
