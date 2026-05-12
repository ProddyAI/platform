import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { getAuthUserId } from "@convex-dev/auth/server";
import { generateObject } from "ai";
import { v } from "convex/values";
import { z } from "zod";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { getMember, mapWorkspaceId } from "./utils";

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

		const mappedWorkspaceId = mapWorkspaceId(args.workspaceId);
		// Use stable roomId based on channelId so we can find & update existing records
		const roomId = `chat-${args.channelId || "unknown"}`;

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
				createdAt: Date.now(),
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
			// Fetch the note to get workspaceId, userId, and lastProcessedIndex
			const note = await ctx.runQuery(api.meetingNotes.getById, {
				noteId: args.noteId,
			});
			if (!note) throw new Error("Note not found");

			const lastProcessedIndex = note.lastProcessedIndex || 0;
			const fullTranscript = args.transcript;

			// Only process NEW transcript content
			const newTranscript = fullTranscript.slice(lastProcessedIndex).trim();

			if (newTranscript.length < 10) {
				// No new content to process
				await ctx.runMutation(internal.meetingNotes.updateStatus, {
					noteId: args.noteId,
					status: "completed",
				});
				throw new Error(
					"No new conversation to summarize since last generation."
				);
			}

			// Update status to generating
			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "generating",
			});

			// Get existing generations to determine generation number
			const existingGenerations = await ctx.runQuery(
				api.meetingNotes.getGenerations,
				{
					roomId: note.roomId,
				}
			);
			const generationNumber = existingGenerations.length + 1;

			const membersInfo = args.membersContext
				? `
The workspace members are:
${args.membersContext}
`
				: "";

			const prompt = `You are an expert AI meeting assistant. Analyze the following meeting transcript and transform it into actionable intelligence.
${membersInfo}
Instructions:
1. **Summary**: Generate a concise smart executive summary.
2. **Action Items**: Extract all action items. For each:
   - Provide a clear task title.
   - Infer who it is assigned to based on the transcript. Match their name to one of the provided workspace members.
   - If a match is found, include their "assigneeUserId" from the context. If no clear assignment is found, leave assigneeUserId empty.
   - Provide the assignee's display name in the "assignee" field.
   - Determine the priority (high, medium, or low).
   - Include any due date mentioned.
3. **Decisions**: List all concrete and specific decisions made.

Transcript:
${newTranscript}`;

			const schema = z.object({
				summary: z
					.string()
					.describe("A concise executive summary of the meeting discussion."),
				actionItems: z
					.array(
						z.object({
							title: z.string().describe("The task description"),
							assignee: z
								.string()
								.optional()
								.describe(
									"The display name of the person assigned to the task"
								),
							assigneeUserId: z
								.string()
								.optional()
								.describe(
									"The userId of the assigned workspace member, if matched"
								),
							dueDate: z
								.string()
								.optional()
								.describe("Optional due date mentioned"),
							priority: z
								.enum(["low", "medium", "high"])
								.optional()
								.describe("Task priority"),
						})
					)
					.describe("Action items extracted from the meeting."),
				decisions: z
					.array(z.string())
					.describe("Key decisions made during the meeting."),
			});

			// Try multiple models with fallback (same as generateChatNotes)
			const models = [
				"gemini-2.5-flash",
				"gemini-2.0-flash",
				"gemini-1.5-flash",
			];
			let lastError: unknown = null;
			let object: any = null;

			const apiKey =
				process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
			if (!apiKey) {
				throw new Error("GEMINI_API_KEY is not set.");
			}

			const google = createGoogleGenerativeAI({ apiKey });

			for (const modelName of models) {
				try {
					const result = await generateObject({
						model: google(modelName),
						schema,
						prompt,
					});
					object = result.object;
					break; // Success — stop trying
				} catch (e) {
					lastError = e;
					const errMsg = e instanceof Error ? e.message : String(e);
					// Retry on 503 (overloaded) or 429 (quota exceeded)
					if (
						errMsg.includes("503") ||
						errMsg.includes("429") ||
						errMsg.includes("Service Unavailable") ||
						errMsg.includes("overloaded") ||
						errMsg.includes("RESOURCE_EXHAUSTED") ||
						errMsg.includes("quota")
					) {
						console.log(
							`Model ${modelName} unavailable/quota exceeded, trying next...`
						);
						continue;
					}
					throw e; // Non-retryable errors
				}
			}

			if (!object && process.env.OPENAI_API_KEY) {
				console.log(
					"All Gemini models failed. Falling back to OpenAI gpt-4o-mini..."
				);
				try {
					const response = await fetch(
						"https://api.openai.com/v1/chat/completions",
						{
							method: "POST",
							headers: {
								"Content-Type": "application/json",
								Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
							},
							body: JSON.stringify({
								model: "gpt-4o-mini",
								response_format: { type: "json_object" },
								messages: [
									{
										role: "system",
										content: `You must respond with valid JSON matching exactly this format:
{
  "summary": "Concise executive summary",
  "actionItems": [
    {
      "title": "Task description",
      "assignee": "Person name or null",
      "dueDate": "Due date or null",
      "priority": "low" | "medium" | "high"
    }
  ],
  "decisions": ["Decision 1", "Decision 2"]
}`,
									},
									{
										role: "user",
										content: prompt,
									},
								],
								temperature: 0.2,
							}),
						}
					);

					if (response.ok) {
						const data = await response.json();
						const parsed = JSON.parse(data.choices[0].message.content);
						if (parsed.summary && parsed.actionItems && parsed.decisions) {
							object = parsed;
						}
					}
				} catch (openaiErr) {
					console.error("OpenAI Fallback Error:", openaiErr);
				}
			}

			if (!object) {
				throw (
					lastError || new Error("All AI models are currently unavailable.")
				);
			}

			// Save as a versioned generation
			await ctx.runMutation(internal.meetingNotes.saveGeneration, {
				meetingNoteId: args.noteId,
				generationNumber,
				summary: object.summary,
				actionItems: (object.actionItems as any[]).map((item: any) => ({
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
		} catch (error) {
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

		const apiKey =
			process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!apiKey) {
			throw new Error(
				"GEMINI_API_KEY is not set in Convex environment variables."
			);
		}

		const { GoogleGenerativeAI } = await import("@google/generative-ai");
		const genAI = new GoogleGenerativeAI(apiKey);

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

		// Try primary model, fallback to secondary on 503
		const models = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash"];
		let lastError: unknown = null;

		for (const modelName of models) {
			try {
				const model = genAI.getGenerativeModel({ model: modelName });
				const result = await model.generateContent({
					contents: [{ role: "user", parts: [{ text: prompt }] }],
					generationConfig: {
						responseMimeType: "application/json",
						temperature: 0.2,
					},
				});

				const responseText = result.response.text();
				const parsed = JSON.parse(responseText);
				return parsed;
			} catch (e) {
				lastError = e;
				const errMsg = e instanceof Error ? e.message : String(e);
				if (
					errMsg.includes("503") ||
					errMsg.includes("429") ||
					errMsg.includes("Service Unavailable") ||
					errMsg.includes("overloaded") ||
					errMsg.includes("RESOURCE_EXHAUSTED") ||
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

		let parsed: any = null;
		if (!parsed && process.env.OPENAI_API_KEY) {
			console.log(
				"All Gemini models failed. Falling back to OpenAI gpt-4o-mini..."
			);
			try {
				const response = await fetch(
					"https://api.openai.com/v1/chat/completions",
					{
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
						},
						body: JSON.stringify({
							model: "gpt-4o-mini",
							response_format: { type: "json_object" },
							messages: [
								{
									role: "system",
									content: `You must respond with valid JSON matching exactly this format:
{
  "title": "Short meeting title",
  "summary": "Concise executive summary",
  "actionItems": [
    {
      "title": "Task description",
      "assigneeName": "Person name or null",
      "assigneeUserId": "User ID or null",
      "priority": "low" | "medium" | "high"
    }
  ],
  "decisions": ["Decision 1", "Decision 2"]
}`,
								},
								{
									role: "user",
									content: prompt,
								},
							],
							temperature: 0.2,
						}),
					}
				);

				if (response.ok) {
					const data = await response.json();
					parsed = JSON.parse(data.choices[0].message.content);
				}
			} catch (openaiErr) {
				console.error("OpenAI Fallback Error:", openaiErr);
			}
		}

		if (parsed) return parsed;

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
		const apiKey =
			process.env.GEMINI_API_KEY || process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!apiKey) {
			throw new Error(
				"GEMINI_API_KEY is not set in Convex environment variables."
			);
		}

		const { GoogleGenerativeAI } = await import("@google/generative-ai");
		const genAI = new GoogleGenerativeAI(apiKey);
		const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

		const systemContext = `You are an AI assistant helping a user understand their meeting or channel transcript.
Here are the AI-generated notes for the transcript:
${args.notes}

Here is the raw transcript:
${args.transcript}

Please answer the user's latest question concisely and accurately based on the transcript and notes.`;

		const chatHistory = args.history.map((m) => ({
			role: m.role === "assistant" ? ("model" as const) : ("user" as const),
			parts: [{ text: m.content }],
		}));

		const result = await model.generateContent({
			contents: [
				{ role: "user", parts: [{ text: systemContext }] },
				{
					role: "model",
					parts: [
						{
							text: "I understand. I'll help you with questions about this meeting. What would you like to know?",
						},
					],
				},
				...chatHistory,
				{ role: "user", parts: [{ text: args.message }] },
			],
		});

		return result.response.text();
	},
});
