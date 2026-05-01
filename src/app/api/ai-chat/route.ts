import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || "");

export async function POST(req: Request) {
	try {
		if (!apiKey) {
			return NextResponse.json(
				{ error: "AI service is not configured. Missing GOOGLE_GENERATIVE_AI_API_KEY." },
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

		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

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

        // Format history for Gemini
        const chat = model.startChat({
            history: [
                {
                    role: "user",
                    parts: [{ text: systemPrompt }]
                },
                {
                    role: "model",
                    parts: [{ text: "Understood. I'm ready to answer questions about the meeting." }]
                },
                ...(history || []).map((msg: any) => ({
                    role: msg.role === "user" ? "user" : "model",
                    parts: [{ text: msg.content }]
                }))
            ],
        });

		const result = await chat.sendMessage(message);
		const responseText = result.response.text();

		return NextResponse.json({ response: responseText });
	} catch (error) {
		console.error("Error in AI Chat:", error);
		return NextResponse.json(
			{ error: "Failed to process chat message." },
			{ status: 500 }
		);
	}
}
