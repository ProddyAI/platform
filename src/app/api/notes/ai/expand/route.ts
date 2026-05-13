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
				"You are an expert writer. Expand on the provided topic with more detail and examples. Maintain the same tone and style as the original. Return the expanded content in markdown format — no meta-commentary, just the content.",
			messages: [
				{
					role: "user",
					content: `Expand the following note with more detail:\n\n${content}`,
				},
			],
			temperature: 0.6,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[Notes AI Expand] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
