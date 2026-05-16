import OpenAI from "openai";

const FILLER_PATTERNS = [
	/^(hi|hey|hello|yo|sup|hiya|howdy)[.!?]*$/i,
	/^(test|testing|ping|check|ok|okay|sure|thanks|thank you|ty|np|cool)[.!?]*$/i,
	/^(yes|no|maybe|ok|k|yep|nope|nah)[.!?]*$/i,
];

export function isFillerMessage(text: string): boolean {
	return FILLER_PATTERNS.some((pattern) => pattern.test(text.trim()));
}

export async function generateConversationTitle(
	messages: Array<{ role: string; content: string }>,
	apiKey: string
): Promise<string> {
	const contextMessages = messages
		.slice(0, 4)
		.filter((m) => m.role === "user" || m.role === "assistant");

	if (contextMessages.length === 0) return "New Chat";

	const userMessages = contextMessages.filter((m) => m.role === "user");
	const hasMeaningfulContent = userMessages.some((m) => !isFillerMessage(m.content));

	if (!hasMeaningfulContent) return "New Chat";

	const openai = new OpenAI({ apiKey });

	try {
		const response = await openai.chat.completions.create({
			model: "gpt-4o-mini",
			messages: [
				{
					role: "system",
					content: `You generate ultra-short, actionable conversation titles for a productivity assistant app.

RULES:
- Exactly 3–6 words. No more, no less.
- Productivity/work-focused tone
- Use Title Case
- No quotes, no punctuation at end
- No generic words like "Chat", "Conversation", "Discussion", "AI", "Assistant"
- Capture the main action or topic

EXAMPLES:
- "Deployment Issue Analysis"
- "GitHub Repository Listing"
- "Sprint Release Planning"
- "Task Priority Review"
- "Daily Task Overview"

Return ONLY the title. Nothing else.`,
				},
				{
					role: "user",
					content: `Generate a title for this conversation:\n\n${contextMessages
						.slice(0, 3)
						.map((m) => `${m.role}: ${m.content.slice(0, 200)}`)
						.join("\n")}`,
				},
			],
			temperature: 0.5,
			max_tokens: 15,
		});

		const raw = response.choices[0]?.message?.content?.trim() || "";
		const title = raw.replace(/^["'`]|["'`]$/g, "").replace(/[.!?]$/, "").trim();
		const wordCount = title.split(/\s+/).filter(Boolean).length;

		if (wordCount >= 2 && wordCount <= 8 && title.length > 0) return title;

		return extractFallbackTitle(userMessages);
	} catch {
		return extractFallbackTitle(userMessages);
	}
}

function extractFallbackTitle(
	userMessages: Array<{ role: string; content: string }>
): string {
	const first = userMessages.find((m) => !isFillerMessage(m.content));
	if (!first) return "New Chat";

	const words = first.content
		.replace(/[^\w\s]/g, " ")
		.split(/\s+/)
		.filter(Boolean)
		.slice(0, 5);

	if (words.length === 0) return "New Chat";

	return words
		.map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
		.join(" ");
}
