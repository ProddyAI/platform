import { getAuthUserId } from "@convex-dev/auth/server";
import { v } from "convex/values";
import { action, internalMutation, mutation, query } from "./_generated/server";
import { api, internal } from "./_generated/api";
import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const mapWorkspaceId = (id: string): string => {
  if (id === "r57b3dwhxc4kb1dkjt6zw6an85pq2m") {
    return "r57b3dwhxc4kb1dkjt6tz6w6an85pq2m";
  }
  return id;
};

// Save or append transcript chunks
export const saveTranscript = mutation({
	args: {
		roomId: v.string(),
		workspaceId: v.string(),
		channelId: v.optional(v.string()),
		transcriptChunk: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) throw new Error("Unauthorized");

		// Find existing note for this room
		const existingNote = await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();

		if (existingNote) {
			// Append chunk
			await ctx.db.patch(existingNote._id, {
				transcript: existingNote.transcript + "\n" + args.transcriptChunk,
			});
			return existingNote._id;
		} else {
			// Create new note
			const newNoteId = await ctx.db.insert("meetingNotes", {
				roomId: args.roomId,
				workspaceId: mapWorkspaceId(args.workspaceId) as any,
				channelId: args.channelId as any,
				transcript: args.transcriptChunk,
				status: "recording",
				userId,
				createdAt: Date.now(),
			});
			return newNoteId;
		}
	},
});

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

export const getByRoom = query({
	args: {
		roomId: v.string(),
	},
	handler: async (ctx, args) => {
		const userId = await getAuthUserId(ctx);
		if (!userId) return null;

		return await ctx.db
			.query("meetingNotes")
			.withIndex("by_room", (q) => q.eq("roomId", args.roomId))
			.first();
	},
});

export const getById = query({
	args: {
		noteId: v.id("meetingNotes"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.noteId);
	},
});

export const generateAIInsights = action({
	args: {
		noteId: v.id("meetingNotes"),
		transcript: v.string(),
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
			// Fetch the note to get workspaceId and userId
			const note = await ctx.runQuery(api.meetingNotes.getById, { noteId: args.noteId });
			if (!note) throw new Error("Note not found");

			// Attempt to update status to generating
			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "generating",
			});

			const { object } = await generateObject({
				model: google("gemini-2.0-flash"),
				schema: z.object({
					summary: z.string().describe("A concise executive summary of the meeting."),
					actionItems: z.array(z.object({
						title: z.string().describe("The task description"),
						assignee: z.string().optional().describe("The person assigned to the task"),
						dueDate: z.string().optional().describe("Optional due date mentioned"),
					})).describe("Action items extracted from the meeting."),
					decisions: z.array(z.string()).describe("Key decisions made during the meeting, formatted as a numbered list item."),
				}),
				prompt: `You are an expert AI meeting assistant. Analyze the following meeting transcript and transform it into actionable intelligence.

1. **Summary**: Generate a concise smart executive summary.
2. **Action Items**: Extract all action items. For each, specify the task, the owner (if mentioned), and the due date (if mentioned).
3. **Decisions**: List all concrete and specific decisions made.
   Format as a numbered list.

Transcript:
${args.transcript}`,
			});

			// Format action items for display in the meeting note
			const formattedActionItems = object.actionItems.map(item => 
				`- ${item.title}${item.assignee ? ` - Assigned to: ${item.assignee}` : ""}${item.dueDate ? ` - Due: ${item.dueDate}` : ""}`
			);

			await ctx.runMutation(internal.meetingNotes.updateNotesData, {
				noteId: args.noteId,
				summary: object.summary,
				actionItems: formattedActionItems,
				decisions: object.decisions,
			});

			// (Stretch Goal) Auto-create tasks in the system
			for (const item of object.actionItems) {
				try {
					await ctx.runMutation(api.tasks.createTask, {
						title: item.title,
						description: `Auto-created from meeting notes. ${item.assignee ? `Assignee: ${item.assignee}` : ""}`,
						workspaceId: note.workspaceId,
						priority: "medium",
						status: "not_started",
					} as any); 
				} catch (taskError) {
					console.error("Failed to auto-create task", taskError);
				}
			}
		} catch (error) {
			console.error("AI Generation Error", error);
			await ctx.runMutation(internal.meetingNotes.updateStatus, {
				noteId: args.noteId,
				status: "failed",
			});
		}
	},
});
