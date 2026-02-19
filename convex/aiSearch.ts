import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import type { ActionCtx, QueryCtx } from "./_generated/server";
import { action, query } from "./_generated/server";

function extractTextFromRichText(body: string): string {
	if (typeof body !== "string") return String(body);
	try {
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: { insert?: string }) =>
					typeof op.insert === "string" ? op.insert : ""
				)
				.join("")
				.trim();
		}
	} catch {
		return body.replace(/<[^>]*>/g, "").trim();
	}
	return body.trim();
}

function cleanAiAnswer(answer: string, userQuery: string): string {
	let cleaned = answer
		.replace(/\*\*(.*?)\*\*/g, "$1")
		.replace(/^\s*\*\s+/gm, "- ")
		.replace(/^\s*•\s+/gm, "- ")
		.replace(/\bKey Points:\s*/i, "Key Points:\n")
		.replace(/\n{3,}/g, "\n\n")
		.replace(/[ \t]{2,}/g, " ")
		.trim();

	const isSummaryIntent = /\b(summarize|summary|recap|overview)\b/i.test(userQuery);
	if (!isSummaryIntent) {
		cleaned = cleaned.replace(/^summary:\s*/i, "");
	}

	const keyPointsLabel = "Key Points:";
	const keyPointsIndex = cleaned.toLowerCase().indexOf(keyPointsLabel.toLowerCase());
	if (keyPointsIndex !== -1) {
		const before = cleaned.slice(0, keyPointsIndex + keyPointsLabel.length);
		let after = cleaned
			.slice(keyPointsIndex + keyPointsLabel.length)
			.replace(/^\s*[-*•]\s*/g, "")
			.replace(/\s+[-*•]\s+/g, "\n- ")
			.replace(/^\s+/, "\n- ");

		after = after
			.split("\n")
			.map((line) => {
				const trimmed = line.trim();
				if (!trimmed) return "";
				if (trimmed.toLowerCase().startsWith("summary:")) return trimmed;
				if (trimmed.toLowerCase().startsWith("key points:")) return "Key Points:";
				return trimmed.startsWith("- ") ? trimmed : `- ${trimmed}`;
			})
			.filter(Boolean)
			.join("\n");

		cleaned = `${before}\n${after}`;
	}

	return cleaned;
}

interface SearchResult {
	messages: Array<{
		_id: Id<"messages">;
		channelId: Id<"channels"> | undefined;
		channelName: string;
		_creationTime: number;
		text: string;
	}>;
	notes: Array<{
		_id: Id<"notes">;
		title: string;
		content: string;
		channelId: Id<"channels">;
	}>;
	tasks: Array<{
		_id: Id<"tasks">;
		title: string;
		description?: string;
	}>;
	cards: Array<{
		_id: Id<"cards">;
		title: string;
		description?: string;
		listId: Id<"lists">;
		channelId: Id<"channels">;
	}>;
}

// Helper query to fetch search data for a workspace
export const getSearchData = query({
	args: { workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		// Fetch messages from all channels in the workspace
		const channels = await ctx.db
			.query("channels")
			.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
			.collect();

		const messages = [];
		for (const channel of channels) {
			const channelMessages = await ctx.db
				.query("messages")
				.filter((q) => q.eq(q.field("channelId"), channel._id))
				.take(100);
			
			messages.push(
				...channelMessages.map((msg) => ({
					_id: msg._id.toString(),
					channelName: channel.name,
					_creationTime: msg._creationTime,
					text: extractTextFromRichText(msg.body),
				}))
			);
		}

		// Fetch notes
		const notes = await ctx.db
			.query("notes")
			.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
			.collect();

		const formattedNotes = notes.map((note) => ({
			title: note.title,
			content: extractTextFromRichText(note.content),
		}));

		// Fetch tasks
		const tasks = await ctx.db
			.query("tasks")
			.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
			.collect();

		const formattedTasks = tasks.map((task) => ({
			title: task.title,
			description: task.description ? extractTextFromRichText(task.description) : undefined,
			dueDate: task.dueDate,
		}));

		// Fetch cards from all lists in channels
		const cards = [];
		for (const channel of channels) {
			const lists = await ctx.db
				.query("lists")
				.filter((q) => q.eq(q.field("channelId"), channel._id))
				.collect();

			for (const list of lists) {
				const listCards = await ctx.db
					.query("cards")
					.filter((q) => q.eq(q.field("listId"), list._id))
					.collect();

				cards.push(
					...listCards.map((card) => ({
						title: card.title,
						description: card.description ? extractTextFromRichText(card.description) : undefined,
						dueDate: card.dueDate,
					}))
				);
			}
		}

		const events = await ctx.db
			.query("events")
			.filter((q) => q.eq(q.field("workspaceId"), args.workspaceId))
			.take(100);

		const formattedEvents = events.map((event) => ({
			title: event.title,
			date: event.date,
			time: event.time,
		}));

		return {
			messages,
			notes: formattedNotes,
			tasks: formattedTasks,
			cards,
			events: formattedEvents,
		};
	},
});

export const aiSearch = action({
	args: {
		query: v.string(),
		openRouterApiKey: v.string(),
		searchData: v.object({
			messages: v.array(v.object({
				_id: v.string(),
				channelName: v.string(),
				_creationTime: v.number(),
				text: v.string(),
			})),
			notes: v.array(v.object({
				title: v.string(),
				content: v.string(),
			})),
			tasks: v.array(v.object({
				title: v.string(),
				description: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})),
			cards: v.array(v.object({
				title: v.string(),
				description: v.optional(v.string()),
				dueDate: v.optional(v.number()),
			})),
			events: v.array(v.object({
				title: v.string(),
				date: v.number(),
				time: v.optional(v.string()),
			})),
		}),
	},
	handler: async (ctx, args) => {
		const userQuery = args.query.trim();
		if (!userQuery) {
			return {
				success: false,
				error: "Empty query",
				answer: null,
				sources: [],
			};
		}

		const greetingPattern = /^(hi|hello|hey|yo|hola|good\s+(morning|afternoon|evening))([!.\s]*)$/i;
		if (greetingPattern.test(userQuery)) {
			return {
				success: true,
				answer:
					"Hi! I can help you search your workspace. Try asking things like: 'What tasks are due this week?', 'Summarize recent messages in #general', or 'Find notes about onboarding'.",
				sources: [],
				dataUsed: {
					messagesCount: 0,
					notesCount: 0,
					tasksCount: 0,
					cardsCount: 0,
					eventsCount: 0,
				},
			};
		}

		try {
			const channelQueryMatch = userQuery.match(/#([a-zA-Z0-9_-]+)/);
			const requestedChannel = channelQueryMatch?.[1]?.toLowerCase();
			const scopedMessages = requestedChannel
				? args.searchData.messages.filter(
					(m) => m.channelName.toLowerCase() === requestedChannel
				)
				: args.searchData.messages;

			const recentMessages = [...scopedMessages]
				.sort((a, b) => b._creationTime - a._creationTime)
				.slice(0, 50);

			// Format data for AI context
			const dataContext = `
## Messages:
${recentMessages
	.map(
		(m) =>
			`- [${m.channelName}] ${new Date(m._creationTime).toLocaleString()}: ${m.text.substring(0, 200)}`
	)
	.join("\n")}

## Notes:
${args.searchData.notes
	.slice(0, 20)
	.map((n) => `- "${n.title}": ${n.content.substring(0, 150)}`)
	.join("\n")}

## Tasks:
${args.searchData.tasks
	.slice(0, 20)
	.map(
		(t) =>
			`- "${t.title}" (due: ${t.dueDate ? new Date(t.dueDate).toLocaleString() : "No due date"}): ${
				t.description?.substring(0, 150) ?? "No description"
			}`
	)
	.join("\n")}

## Board Cards:
${args.searchData.cards
	.slice(0, 20)
	.map(
		(c) =>
			`- "${c.title}" (due: ${c.dueDate ? new Date(c.dueDate).toLocaleString() : "No due date"}): ${
				c.description?.substring(0, 150) ?? "No description"
			}`
	)
	.join("\n")}

## Calendar Events:
${args.searchData.events
	.slice(0, 30)
	.map(
		(e) =>
			`- "${e.title}" at ${new Date(e.date).toLocaleDateString()}${e.time ? ` ${e.time}` : ""}`
	)
	.join("\n")}
`;

			const openRouterApiKey = args.openRouterApiKey;
			if (!openRouterApiKey) {
				console.error("[aiSearch] OpenRouter API key not provided");
				return {
					success: false,
					error: "AI service not configured",
					answer: null,
					sources: [],
				};
			}

			const now = new Date();
			const prompt = `You are a workspace assistant. Based on the following workspace data, answer the user's question concisely and accurately.

Workspace Data:
${dataContext}

User Question: ${userQuery}

Current Date/Time: ${now.toLocaleString()}

Rules:
- Use ONLY the provided workspace data.
- For schedule/day/today questions, prioritize Calendar Events and due dates from Tasks/Cards.
- Do NOT invent times or meetings.
- If no relevant schedule items exist, explicitly say no events/tasks are scheduled for that timeframe.
- For channel summaries (e.g. #general), only summarize messages from that exact channel.
- Keep output clean and easy to read.
- For explicit summary requests (e.g. "summarize", "recap"), start with: Summary: <1-2 short sentences>.
- For normal questions, return a direct plain-text answer without the "Summary:" label.
- Add "Key Points:" only when necessary (for example: multiple important items, actionables, or timelines).
- If used, each key point must be on its own line and start with "- ".
- If the answer is simple/single-point, do NOT include "Key Points:".
- Do not use markdown bold, asterisks, or decorative symbols.

Provide a clear, concise answer under 500 words.`;

			const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
				method: "POST",
				headers: {
					Authorization: `Bearer ${openRouterApiKey}`,
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					model: "google/gemini-2.5-flash",
					temperature: 0.7,
					max_tokens: 1000,
					messages: [
						{
							role: "user",
							content: prompt,
						},
					],
				}),
			});

			if (!response.ok) {
				const responseBody = await response.text();
				throw new Error(`OpenRouter error (${response.status}): ${responseBody}`);
			}

			const payload = await response.json();
			const rawAnswer = payload?.choices?.[0]?.message?.content?.trim();
			const answer = rawAnswer ? cleanAiAnswer(rawAnswer, userQuery) : rawAnswer;

			if (!answer) {
				return {
					success: false,
					error: "Failed to generate answer",
					answer: null,
					sources: [],
				};
			}

			// Identify sources mentioned in the answer
			const query = userQuery.toLowerCase();
			const isScheduleQuery =
				/(today|day|schedule|agenda|calendar|meeting|events?|tomorrow|week)/i.test(query);
			const isChannelQuery = /#[a-z0-9_-]+/i.test(query) || /\b(messages?|channel|chat|summari[sz]e)\b/i.test(query);
			const isTaskQuery = /\b(task|todo|overdue|due)\b/i.test(query);
			const isCardQuery = /\b(card|board|kanban|list)\b/i.test(query);
			const isNoteQuery = /\b(note|notes|doc|docs|documentation)\b/i.test(query);

			const sources = [];

			if (isChannelQuery) {
				if (recentMessages.length > 0) sources.push("messages");
			} else if (isCardQuery) {
				if (args.searchData.cards.length > 0) sources.push("cards");
				if (isScheduleQuery && args.searchData.tasks.some((task) => task.dueDate)) {
					sources.push("tasks");
				}
			} else if (isNoteQuery) {
				if (args.searchData.notes.length > 0) sources.push("notes");
			} else if (isTaskQuery) {
				if (args.searchData.tasks.length > 0) sources.push("tasks");
			} else if (isScheduleQuery) {
				if (args.searchData.events.length > 0) sources.push("events");
				if (args.searchData.tasks.some((task) => task.dueDate)) sources.push("tasks");
				if (args.searchData.cards.some((card) => card.dueDate)) sources.push("cards");
			}

			if (sources.length === 0) {
				if (isScheduleQuery && args.searchData.events.length > 0) sources.push("events");
				else if (isTaskQuery && args.searchData.tasks.length > 0) sources.push("tasks");
				else if (isCardQuery && args.searchData.cards.length > 0) sources.push("cards");
				else if (isNoteQuery && args.searchData.notes.length > 0) sources.push("notes");
				else if (recentMessages.length > 0) sources.push("messages");
			}

			return {
				success: true,
				answer,
				sources,
				dataUsed: {
					messagesCount: args.searchData.messages.length,
					notesCount: args.searchData.notes.length,
					tasksCount: args.searchData.tasks.length,
					cardsCount: args.searchData.cards.length,
					eventsCount: args.searchData.events.length,
				},
			};
		} catch (error) {
			console.error("AI Search error:", error);
			return {
				success: false,
				error: `AI search failed: ${error instanceof Error ? error.message : "Unknown error"}`,
				answer: null,
				sources: [],
			};
		}
	},
});
