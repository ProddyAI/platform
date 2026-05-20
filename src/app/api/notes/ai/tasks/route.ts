import type { NextRequest } from "next/server";
import { streamNoteAction } from "../stream-note-action";

export async function POST(req: NextRequest) {
	return streamNoteAction(req, {
		actionLabel: "Tasks",
		systemPrompt:
			"You are a productivity assistant. Extract actionable tasks from the note. Format the output as a markdown checklist. Each task must start with a verb and be specific and actionable. Use this format:\n- [ ] Task description\nReturn only the checklist — no explanations, no headers.",
		userPromptPrefix: "Extract tasks from the following note:",
		temperature: 0.4,
	});
}
