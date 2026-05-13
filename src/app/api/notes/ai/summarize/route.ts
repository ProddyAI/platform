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
				"You are a concise summarizer. Create a 2-3 sentence summary of the note. Focus on key points and main takeaways. Return only the summary in plain text — no bullet points, no headers.",
			messages: [
				{
					role: "user",
					content: `Summarize the following note:\n\n${content}`,
				},
			],
			temperature: 0.3,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[Notes AI Summarize] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
