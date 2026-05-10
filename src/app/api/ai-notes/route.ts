import { GoogleGenerativeAI } from "@google/generative-ai";
import { NextResponse } from "next/server";

const apiKey =
	process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;

export async function POST(req: Request) {
	try {
		if (!apiKey) {
			return NextResponse.json(
				{ error: "Missing GEMINI API Key" },
				{ status: 500 }
			);
		}

		const body = await req.json();
		const { transcript, membersContext } = body;

		if (!transcript) {
			return NextResponse.json(
				{ error: "Transcript is required." },
				{ status: 400 }
			);
		}

		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

		const prompt = `
You are an expert AI Meeting Assistant. Your job is to analyze the following meeting transcript and extract structured intelligence.

The workspace members are:
${membersContext}

Instructions:
1. Provide a concise executive summary of the meeting.
2. Identify all action items (tasks). For each action item:
   - Provide a clear title.
   - Infer who it is assigned to based on the transcript. Match their name to one of the provided workspace members.
   - If a match is found, include their "assigneeUserId" from the context. If no clear assignment is found or the person is not in the context, leave "assigneeUserId" as null but you can provide the "assigneeName".
   - Determine the priority (high, medium, or low).
3. Identify all key decisions made during the meeting.

You MUST respond in valid JSON format exactly matching this schema:
{
  "summary": "String",
  "actionItems": [
    {
      "title": "String",
      "assigneeName": "String | null",
      "assigneeUserId": "String | null",
      "priority": "high | medium | low"
    }
  ],
  "decisions": ["String"]
}

Meeting Transcript:
${transcript}
`;

		const result = await model.generateContent({
			contents: [{ role: "user", parts: [{ text: prompt }] }],
			generationConfig: {
				responseMimeType: "application/json",
				temperature: 0.2,
			},
		});

		const responseText = result.response.text();

		try {
			const parsedNotes = JSON.parse(responseText);
			return NextResponse.json({ notes: parsedNotes });
		} catch (_parseError) {
			console.error("[AI-NOTES] Failed to parse JSON:", responseText);
			return NextResponse.json(
				{ error: "AI generated an invalid response format." },
				{ status: 500 }
			);
		}
	} catch (error: any) {
		console.error("[AI-NOTES] Error:", error?.message || error);
		return NextResponse.json(
			{ error: error?.message || "Failed to generate meeting notes." },
			{ status: 500 }
		);
	}
}
