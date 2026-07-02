import { openai } from "@ai-sdk/openai";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateObject, generateText } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { getMember } from "./utils";

// ─── TYPES ──────────────────────────────────────────────────────────────────

type AIActionItem = {
	title: string;
	assignee?: string;
	assigneeUserId?: string;
	dueDate?: string;
	priority?: "low" | "medium" | "high";
};

type AIInsightsResponse = {
	summary: string;
	actionItems: AIActionItem[];
	decisions: string[];
};

// ─── HELPER FUNCTIONS ───────────────────────────────────────────────────────

/**
 * Executes AI generation with fallback logic across multiple models.
 */
async function executeAIGeneration(
	prompt: string,
	schema: z.ZodTypeAny
): Promise<AIInsightsResponse | null> {
	const models = ["gpt-4o-mini", "gpt-4o"];

	if (!process.env.OPENAI_API_KEY) {
		throw new Error("OPENAI_API_KEY is not set.");
	}

	let lastError: unknown = null;
	let resultObject: AIInsightsResponse | null = null;

	for (const modelName of models) {
		try {
			const result = await generateObject({
				output: "object",
				model: openai(modelName),
				schema: schema as z.ZodTypeAny,
				prompt,
			});
			resultObject = result.object;
			break;
		} catch (e) {
			lastError = e;
			const errMsg = e instanceof Error ? e.message : String(e);
			const retryableErrors = [
				"503",
				"429",
				"404",
				"Not Found",
				"Service Unavailable",
				"overloaded",
				"RESOURCE_EXHAUSTED",
				"quota",
			];

			if (retryableErrors.some((err) => errMsg.includes(err))) {
				// skipcq: JS-0002
				console.log(
					`Model ${modelName} unavailable/quota exceeded, trying next...`
				);
				continue;
			}
			throw e;
		}
	}

	if (!resultObject) {
		throw lastError || new Error("All AI models are currently unavailable.");
	}

	return resultObject;
}

// ─── QUERIES ─────────────────────────────────────────────────────────────────

// Get last generation info for a channel (used by period picker)
export const getChatNoteForChannel = query({
	args: { channelId: v.string(), workspaceId: v.id("workspaces") },
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member) return null;

		const roomId = `chat-${args.channelId}`;
		const note = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", roomId))
			.first();
		if (!note) return null;
		return { lastGeneratedAt: note.lastGeneratedAt || note.createdAt };
	},
});

// ─── TRANSCRIPT MANAGEMENT ───────────────────────────────────────────────────

// Save or append transcript chunks (called continuously during recording)
export const saveTranscript = mutation({
	args: {
		roomId: v.string(),
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		transcriptChunk: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member)
			throw new Error("Unauthorized: Not a member of this workspace");

		// Find existing note for this room
		const existingNote = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();

		if (existingNote) {
			// Verify the note belongs to this workspace
			if (existingNote.workspaceId !== args.workspaceId) {
				throw new Error("Unauthorized: Room does not belong to this workspace");
			}

			// Append chunk
			await ctx.db.patch(existingNote._id, {
				transcript: `${existingNote.transcript}\n${args.transcriptChunk}`,
			});
			return existingNote._id;
		} else {
			// Create new note
			const newNoteId = await ctx.db.insert("meetingNotes", {
				roomId: args.roomId,
				workspaceId: args.workspaceId,
				channelId: args.channelId,
				transcript: args.transcriptChunk,
				status: "recording",
				userId,
				createdAt: Date.now(),
				lastProcessedIndex: 0,
				source: "live",
			});
			return newNoteId;
		}
	},
});

// Finalize transcript when recording stops
export const finalizeTranscript = mutation({
	args: {
		roomId: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const note = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();

		if (!note) throw new Error("No transcript found for this room");

		// Verify membership
		const member = await getMember(ctx, note.workspaceId, userId);
		if (!member)
			throw new Error("Unauthorized: Not a member of this workspace");

		// Only update status, don't change transcript
		if (note.status === "recording") {
			await ctx.db.patch(note._id, {
				status: "completed",
			});
		}

		return note._id;
	},
});

// ─── QUERIES ─────────────────────────────────────────────────────────────────

export const getByRoom = query({
	args: {
		roomId: v.string(),
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member) return null;

		const note = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();

		if (!note || note.workspaceId !== args.workspaceId) return null;

		return note;
	},
});

export const getById = query({
	args: {
		noteId: v.id("meetingNotes"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const note = await ctx.db.get(args.noteId);
		if (!note) return null;

		const member = await getMember(ctx, note.workspaceId, userId);
		if (!member) return null;

		return note;
	},
});

// Get all note generations for a meeting
export const getGenerations = query({
	args: {
		roomId: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const note = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();

		if (!note) return [];

		const member = await getMember(ctx, note.workspaceId, userId);
		if (!member) return [];

		return await ctx.db
			.query("meetingNoteGenerations")
			.withIndex("by_meeting_note", (q) => q.eq("meetingNoteId", note._id))
			.collect();
	},
});

// Get a specific generation
export const getGeneration = query({
	args: {
		generationId: v.id("meetingNoteGenerations"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		const generation = await ctx.db.get(args.generationId);
		if (!generation) return null;

		const note = await ctx.db.get(generation.meetingNoteId);
		if (!note) return null;

		const member = await getMember(ctx, note.workspaceId, userId);
		if (!member) return null;

		return generation;
	},
});

// Get all meeting notes for a workspace (for history browsing)
export const getByWorkspace = query({
	args: {
		workspaceId: v.id("workspaces"),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return [];

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member) return [];

		return await ctx.db
			.query("meetingNotes")
			.withIndex("by_workspace", (q) => q.eq("workspaceId", args.workspaceId))
			.collect();
	},
});

// Save channel-generated AI notes to meetingNotes for unified history
export const saveChatNotesToHistory = mutation({
	args: {
		workspaceId: v.id("workspaces"),
		channelId: v.optional(v.id("channels")),
		conversationId: v.optional(v.id("conversations")),
		title: v.optional(v.string()),
		transcript: v.string(),
		summary: v.string(),
		actionItems: v.array(v.string()),
		decisions: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member)
			throw new Error("Unauthorized: Not a member of this workspace");

		// Use stable roomId based on channelId or conversationId so we can find & update existing records
		const roomId = args.channelId
			? `chat-${args.channelId}`
			: args.conversationId
				? `chat-${args.conversationId}`
				: `chat-unknown-${userId}`;

		// Check for existing note for this channel
		const existingNote = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", roomId))
			.first();

		if (existingNote) {
			// Verify the note belongs to this workspace
			if (existingNote.workspaceId !== args.workspaceId) {
				throw new Error("Unauthorized: Room does not belong to this workspace");
			}

			// Update existing record instead of creating a duplicate
			await ctx.db.patch(existingNote._id, {
				title: args.title || existingNote.title,
				transcript: args.transcript,
				summary: args.summary,
				actionItems: args.actionItems,
				decisions: args.decisions,
				status: "completed",
				lastGeneratedAt: Date.now(),
			});
			return existingNote._id;
		} else {
			// Create new record
			const noteId = await ctx.db.insert("meetingNotes", {
				roomId,
				title: args.title || undefined,
				workspaceId: args.workspaceId,
				channelId: args.channelId,
				transcript: args.transcript,
				summary: args.summary,
				actionItems: args.actionItems,
				decisions: args.decisions,
				status: "completed",
				userId,
				createdAt: Date.now(),
				lastProcessedIndex: 0,
				source: "live",
				lastGeneratedAt: Date.now(),
			});
			return noteId;
		}
	},
});

// ─── INTERNAL MUTATIONS (called from Actions) ───────────────────────────────

// Update meeting notes via internal mutation (called from Action)
export const updateNotesData = internalMutation({
	args: {
		noteId: v.id("meetingNotes"),
		summary: v.string(),
		actionItems: v.array(v.string()),
		decisions: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.noteId, {
			summary: args.summary,
			actionItems: args.actionItems,
			decisions: args.decisions,
			status: "completed",
		});
	},
});

// Save a versioned generation
export const saveGeneration = internalMutation({
	args: {
		meetingNoteId: v.id("meetingNotes"),
		generationNumber: v.number(),
		summary: v.string(),
		actionItems: v.array(
			v.object({
				title: v.string(),
				assignee: v.optional(v.string()),
				assigneeUserId: v.optional(v.string()),
				dueDate: v.optional(v.string()),
				priority: v.optional(
					v.union(v.literal("low"), v.literal("medium"), v.literal("high"))
				),
			})
		),
		decisions: v.array(v.string()),
		processedTranscriptStart: v.number(),
		processedTranscriptEnd: v.number(),
	},
	handler: async (ctx, args) => {
		const genId = await ctx.db.insert("meetingNoteGenerations", {
			meetingNoteId: args.meetingNoteId,
			generationNumber: args.generationNumber,
			summary: args.summary,
			actionItems: args.actionItems,
			decisions: args.decisions,
			processedTranscriptStart: args.processedTranscriptStart,
			processedTranscriptEnd: args.processedTranscriptEnd,
			createdAt: Date.now(),
		});

		// Also update the parent note with latest generation data
		const formattedItems = args.actionItems.map(
			(item) =>
				`- ${item.title}${item.assignee ? ` → ${item.assignee}` : ""}${item.dueDate ? ` (Due: ${item.dueDate})` : ""}`
		);

		await ctx.db.patch(args.meetingNoteId, {
			summary: args.summary,
			actionItems: formattedItems,
			decisions: args.decisions,
			status: "completed",
			lastProcessedIndex: args.processedTranscriptEnd,
		});

		return genId;
	},
});

// Update status
export const updateStatus = internalMutation({
	args: {
		noteId: v.id("meetingNotes"),
		status: v.union(
			v.literal("recording"),
			v.literal("generating"),
			v.literal("completed"),
			v.literal("failed")
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.noteId, {
			status: args.status,
		});
	},
});

// ─── AI GENERATION (Incremental) ────────────────────────────────────────────

export const generateAIInsights = action({
	args: {
		noteId: v.id("meetingNotes"),
		transcript: v.string(),
		membersContext: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		if (!args.transcript || args.transcript.trim().length < 10) {
			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "failed",
			});
			return;
		}

		try {
			const note = await ctx.runQuery(api.meetingNotes.getById, {
				noteId: args.noteId,
			});
			if (!note) throw new Error("Note not found");

			const lastProcessedIndex = note.lastProcessedIndex || 0;
			const fullTranscript = args.transcript;
			const newTranscript = fullTranscript.slice(lastProcessedIndex).trim();

			if (newTranscript.length < 10) {
				await ctx.runMutation(internal.meetingNotes.updateStatus, {
					noteId: args.noteId,
					status: "completed",
				});
				throw new Error("No new conversation to summarize.");
			}

			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "generating",
			});

			const existingGenerations = await ctx.runQuery(
				api.meetingNotes.getGenerations,
				{ roomId: note.roomId }
			);
			const generationNumber = existingGenerations.length + 1;

			const membersInfo = args.membersContext
				? `\nThe workspace members are:\n${args.membersContext}\n`
				: "";

			const prompt = `You are an expert AI meeting assistant. Analyze the following meeting transcript and transform it into actionable intelligence.
${membersInfo}
Instructions:
1. **Summary**: Generate a comprehensive and professional executive summary.
2. **Action Items**: Extract EVERY action item, task, or follow-up. For each, include title, assignee, assigneeUserId (if matched), priority (low, medium, high), and dueDate.
3. **Decisions**: List all concrete and specific decisions made.

Transcript:
${newTranscript}`;

			const schema = z.object({
				summary: z.string(),
				actionItems: z.array(
					z.object({
						title: z.string(),
						assignee: z.string().optional(),
						assigneeUserId: z.string().optional(),
						dueDate: z.string().optional(),
						priority: z.enum(["low", "medium", "high"]).optional(),
					})
				),
				decisions: z.array(z.string()),
			});

			const object = await executeAIGeneration(prompt, schema as z.ZodTypeAny);

			if (object) {
				await ctx.runMutation(internal.meetingNotes.saveGeneration, {
					meetingNoteId: args.noteId,
					generationNumber,
					summary: object.summary,
					actionItems: object.actionItems.map((item) => ({
						title: item.title,
						assignee: item.assignee || undefined,
						assigneeUserId: item.assigneeUserId || undefined,
						dueDate: item.dueDate || undefined,
						priority: item.priority || undefined,
					})),
					decisions: object.decisions,
					processedTranscriptStart: lastProcessedIndex,
					processedTranscriptEnd: fullTranscript.length,
				});
			}
		} catch (error) {
			// skipcq: JS-0002
			console.error("AI Generation Error", error);
			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "failed",
			});
			throw new Error(
				error instanceof Error ? error.message : "Failed to generate AI notes"
			);
		}
	},
});

// ─── SAVE MEETING NOTES (for direct save / upload pipeline) ─────────────────

export const saveMeetingNotes = mutation({
	args: {
		meetingId: v.string(),
		workspaceId: v.id("workspaces"),
		transcript: v.string(),
		summary: v.string(),
		actionItems: v.array(v.any()),
		decisions: v.array(v.string()),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member)
			throw new Error("Unauthorized: Not a member of this workspace");

		const existingNote = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.meetingId))
			.first();

		const formattedActionItems = args.actionItems.map((a) =>
			typeof a === "string" ? a : JSON.stringify(a)
		);

		if (existingNote) {
			// Verify the note belongs to this workspace
			if (existingNote.workspaceId !== args.workspaceId) {
				throw new Error("Unauthorized: Room does not belong to this workspace");
			}

			await ctx.db.patch(existingNote._id, {
				transcript: args.transcript,
				summary: args.summary,
				actionItems: formattedActionItems,
				decisions: args.decisions,
				status: "completed",
			});
			return existingNote._id;
		} else {
			return await ctx.db.insert("meetingNotes", {
				roomId: args.meetingId,
				workspaceId: args.workspaceId,
				transcript: args.transcript,
				summary: args.summary,
				actionItems: formattedActionItems,
				decisions: args.decisions,
				status: "completed",
				userId,
				createdAt: Date.now(),
				lastProcessedIndex: args.transcript.length,
				source: "upload",
			});
		}
	},
});

// Save transcript from upload
export const saveUploadTranscript = mutation({
	args: {
		roomId: v.string(),
		workspaceId: v.id("workspaces"),
		transcript: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		const member = await getMember(ctx, args.workspaceId, userId);
		if (!member)
			throw new Error("Unauthorized: Not a member of this workspace");

		const noteId = await ctx.db.insert("meetingNotes", {
			roomId: args.roomId,
			workspaceId: args.workspaceId,
			transcript: args.transcript,
			status: "completed",
			userId,
			createdAt: Date.now(),
			lastProcessedIndex: 0,
			source: "upload",
		});
		return noteId;
	},
});

// ─── CHAT-BASED NOTE GENERATION ─────────────────────────────────────────────

export const generateChatNotes = action({
	args: {
		transcript: v.string(),
		membersContext: v.string(),
	},
	handler: async (_ctx, args) => {
		if (!args.transcript || args.transcript.trim().length === 0) {
			throw new Error("Transcript is required.");
		}

		if (!process.env.OPENAI_API_KEY) {
			throw new Error(
				"OPENAI_API_KEY is not set in Convex environment variables."
			);
		}

		const chatNotesSchema = z.object({
			title: z.string(),
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

		const prompt = `
You are an expert AI Meeting Assistant. Your job is to analyze the following meeting transcript and extract structured intelligence.

The workspace members are:
${args.membersContext}

Instructions:
1. Generate a short, descriptive title (max 8 words) that captures the main topic of the meeting.
2. Provide a concise executive summary of the meeting.
3. Identify all action items (tasks). For each action item:
   - Provide a clear title.
   - Infer who it is assigned to based on the transcript. Match their name to one of the provided workspace members.
   - If a match is found, include their "assigneeUserId" from the context. If no clear assignment is found or the person is not in the context, leave "assigneeUserId" as null but you can provide the "assigneeName".
   - Determine the priority (high, medium, or low).
4. Identify all key decisions made during the meeting.

You MUST respond in valid JSON format exactly matching this schema:
{
  "title": "String - short descriptive heading for the meeting",
  "summary": "String",
  "actionItems": [
    {
      "title": "String",
      "assigneeName": "String or null",
      "assigneeUserId": "String or null",
      "priority": "high | medium | low"
    }
  ],
  "decisions": ["String"]
}

Transcript:
${args.transcript}
`;

		// Try primary model, fall back to secondary on transient errors
		const models = ["gpt-4o-mini", "gpt-4o"];
		let lastError: unknown = null;

		for (const modelName of models) {
			try {
				const result = await generateObject({
					output: "object",
					model: openai(modelName),
					schema: chatNotesSchema,
					prompt,
					temperature: 0.2,
				});
				return result.object;
			} catch (e) {
				lastError = e;
				const errMsg = e instanceof Error ? e.message : String(e);
				if (
					errMsg.includes("503") ||
					errMsg.includes("429") ||
					errMsg.includes("500") ||
					errMsg.includes("Service Unavailable") ||
					errMsg.includes("overloaded") ||
					errMsg.includes("rate limit") ||
					errMsg.includes("quota")
				) {
					console.log(
						`Model ${modelName} unavailable/quota exceeded, trying next...`
					);
					continue;
				}
				throw e;
			}
		}

		throw (
			lastError ||
			new Error(
				"All AI models are currently unavailable. Please try again later."
			)
		);
	},
});

// ─── CHAT WITH NOTES ────────────────────────────────────────────────────────

export const chatWithNotes = action({
	args: {
		transcript: v.string(),
		notes: v.string(),
		history: v.array(
			v.object({
				role: v.string(),
				content: v.string(),
			})
		),
		message: v.string(),
	},
	handler: async (_ctx, args) => {
		if (!process.env.OPENAI_API_KEY) {
			throw new Error(
				"OPENAI_API_KEY is not set in Convex environment variables."
			);
		}

		const systemContext = `You are an AI assistant helping a user understand their meeting or channel transcript.
Here are the AI-generated notes for the transcript:
${args.notes}

Here is the raw transcript:
${args.transcript}

Please answer the user's latest question concisely and accurately based on the transcript and notes.`;

		const chatHistory = args.history.map((m) => ({
			role:
				m.role === "assistant" ? ("assistant" as const) : ("user" as const),
			content: m.content,
		}));

		const result = await generateText({
			model: openai("gpt-4o-mini"),
			messages: [
				{ role: "system", content: systemContext },
				...chatHistory,
				{ role: "user", content: args.message },
			],
		});

		return result.text;
	},
});
