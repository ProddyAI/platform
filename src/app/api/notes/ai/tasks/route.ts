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
				"You are a productivity assistant. Extract actionable tasks from the note. Format the output as a markdown checklist. Each task must start with a verb and be specific and actionable. Use this format:\n- [ ] Task description\nReturn only the checklist — no explanations, no headers.",
			messages: [
				{
					role: "user",
					content: `Extract tasks from the following note:\n\n${content}`,
				},
			],
			temperature: 0.4,
		});

		return result.toTextStreamResponse();
	} catch (error) {
		console.error("[Notes AI Tasks] Error:", error);
		return NextResponse.json(
			{ error: "Internal server error" },
			{ status: 500 }
		);
	}
}
