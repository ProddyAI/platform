import type { NextRequest } from "next/server";
import { streamNoteAction } from "../stream-note-action";

export async function POST(req: NextRequest) {
	return streamNoteAction(req, {
		actionLabel: "Clean",
		systemPrompt:
			"You are an expert editor. Fix grammar and improve clarity of the note. Maintain the original meaning and structure. Return only the cleaned-up version in markdown format — no explanations, no meta-commentary.",
		userPromptPrefix: "Clean up the following note:",
		temperature: 0.3,
	});
}
