import type { NextRequest } from "next/server";
import { streamNoteAction } from "../stream-note-action";

export async function POST(req: NextRequest) {
	return streamNoteAction(req, {
		actionLabel: "Summarize",
		systemPrompt:
			"You are a concise summarizer. Create a 2-3 sentence summary of the note. Focus on key points and main takeaways. Return only the summary in plain text — no bullet points, no headers.",
		userPromptPrefix: "Summarize the following note:",
		temperature: 0.3,
	});
}
