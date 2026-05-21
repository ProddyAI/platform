import type { NextRequest } from "next/server";
import { streamNoteAction } from "../stream-note-action";

export async function POST(req: NextRequest) {
	return streamNoteAction(req, {
		actionLabel: "Expand",
		systemPrompt:
			"You are an expert writer. Expand on the provided topic with more detail and examples. Maintain the same tone and style as the original. Return the expanded content in markdown format — no meta-commentary, just the content.",
		userPromptPrefix: "Expand the following note with more detail:",
		temperature: 0.6,
	});
}
