import { openai } from "@ai-sdk/openai";
import { generateText } from "ai";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "AI service is not configured. Missing OPENAI_API_KEY." },
				{ status: 500 }
			);
		}

		const body = await req.json();
		const { transcript, notes, history, message } = body;

		if (!message) {
			return NextResponse.json(
				{ error: "Message is required." },
				{ status: 400 }
			);
		}

		const systemPrompt = `
You are a helpful AI Meeting Assistant inside a collaboration tool.
You are currently chatting with a user about a specific channel/meeting.

Here is the meeting transcript context:
${transcript}

Here is the structured intelligence (notes) already extracted from the meeting:
${notes}

Instructions:
1. Answer the user's questions based primarily on the transcript and notes.
2. If the user asks something not in the transcript, state that clearly but try to be helpful if it's a general question.
3. Keep your answers concise, well-formatted, and professional.
`;

		const chatHistory = ((history || []) as { role: string; content: string }[])
			.map((msg) => ({
				role:
					msg.role === "assistant"
						? ("assistant" as const)
						: ("user" as const),
				content: msg.content,
			}));

		const { text } = await generateText({
			model: openai("gpt-4o-mini"),
			messages: [
				{ role: "system", content: systemPrompt },
				...chatHistory,
				{ role: "user", content: message },
			],
		});

		return NextResponse.json({ response: text });
	} catch (error) {
		console.error("Error in AI Chat:", error);
		return NextResponse.json(
			{ error: "Failed to process chat message." },
			{ status: 500 }
		);
	}
}
