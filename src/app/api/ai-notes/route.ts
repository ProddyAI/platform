import { NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// Ensure the API key is set
const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GOOGLE_GENERATIVE_AI_API_KEY and GEMINI_API_KEY are not defined in the environment variables.");
}

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
		const { transcript, membersContext } = body;

		if (!transcript) {
			return NextResponse.json(
				{ error: "Transcript is required." },
				{ status: 400 }
			);
		}

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
            }
        });
        
		const responseText = result.response.text();
		
		try {
			const parsedNotes = JSON.parse(responseText);
			return NextResponse.json({ notes: parsedNotes });
		} catch (parseError) {
			console.error("Failed to parse Gemini JSON response:", responseText);
			return NextResponse.json(
				{ error: "AI generated an invalid response format." },
				{ status: 500 }
			);
		}
	} catch (error) {
		console.error("Error in AI Notes generation:", error);
		return NextResponse.json(
			{ error: "Failed to generate meeting notes." },
			{ status: 500 }
		);
	}
}
