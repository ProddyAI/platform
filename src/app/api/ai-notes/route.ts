import { openai } from "@ai-sdk/openai";
import { generateObject } from "ai";
import { NextResponse } from "next/server";
import { z } from "zod";

const notesSchema = z.object({
	summary: z.string(),
	actionItems: z.array(
		z.object({
			title: z.string(),
			assigneeName: z.string().nullable(),
			assigneeUserId: z.string().nullable(),
			priority: z.enum(["high", "medium", "low"]),
		})
	),
	decisions: z.array(z.string()),
});

export async function POST(req: Request) {
	try {
		if (!process.env.OPENAI_API_KEY) {
			return NextResponse.json(
				{ error: "AI service is not configured. Missing OPENAI_API_KEY." },
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

Meeting Transcript:
${transcript}
`;

		const { object } = await generateObject({
			model: openai("gpt-4o-mini"),
			schema: notesSchema,
			prompt,
			temperature: 0.2,
		});

		return NextResponse.json({ notes: object });
	} catch (error) {
		console.error(
			"[AI-NOTES] Error:",
			error instanceof Error ? error.message : error
		);
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Failed to generate meeting notes.",
			},
			{ status: 500 }
		);
	}
}
