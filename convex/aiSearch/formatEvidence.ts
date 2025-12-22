const MAX_TEXT_LENGTH = 300;


import { Id } from "../_generated/dataModel";
import { v } from "convex/values";

/**
 * Helper function to extract plain text from rich text (Quill Delta format)
 */
function extractTextFromRichText(body: string): string {
	if (typeof body !== 'string') {
		return String(body);
	}

	try {
		// Try to parse as JSON (Quill Delta format)
		const parsedBody = JSON.parse(body);
		if (parsedBody.ops) {
			return parsedBody.ops
				.map((op: any) => (typeof op.insert === 'string' ? op.insert : ''))
				.join('')
				.trim();
		}
	} catch (e) {
		// Not JSON, use as is (might contain HTML)
		return body
			.replace(/<[^>]*>/g, '') // Remove HTML tags
			.trim();
	}

	return body.trim();
}

/**
 * Evidence item representing a piece of content found in search
 */
export type EvidenceItem = {
	type: 'message' | 'task' | 'note' | 'card';
	id: Id<any>;
	text: string;
	metadata?: {
		channelId?: Id<'channels'>;
		channelName?: string;
		conversationId?: Id<'conversations'>;
		memberId?: Id<'members'>;
		userId?: Id<'users'>;
		status?: string;
		listName?: string;
		createdAt?: number;
	};
};

/**
 * Formats evidence items into a string for LLM summarization.
 * Each item is formatted with its type, content, and relevant metadata.
 */
export function formatEvidence(evidence: EvidenceItem[]): string {
    if (evidence.length === 0) return "";
  
    const formattedItems: string[] = [];
  
    for (const item of evidence) {
      let formatted = "";
  
      switch (item.type) {
        case "message":
          formatted = `Message:\n${item.text}`;
          break;
        case "task":
          formatted = `Task:\n${item.text}`;
          break;
        case "note":
          formatted = `Note:\n${item.text}`;
          break;
        case "card":
          formatted = `Card:\n${item.text}`;
          break;
      }
  
      formattedItems.push(formatted);
    }
  
    return formattedItems.join("\n\n");
  }  

/**
 * Re-hydrates a message entity from the database and formats it as evidence.
 * Returns null if the message cannot be accessed or doesn't exist.
 */
export const hydrateMessage = query({
	args: {
		messageId: v.id('messages'),
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
	},
	handler: async (ctx, args): Promise<EvidenceItem | null> => {
		const message = await ctx.db.get(args.messageId);
		if (!message) return null;

		// Verify workspace matches
		if (message.workspaceId !== args.workspaceId) return null;

		// Get channel info if available
		let channelName: string | undefined;
		if (message.channelId) {
			const channel = await ctx.db.get(message.channelId);
			channelName = channel?.name;
		}

		const text = extractTextFromRichText(message.body).slice(0, MAX_TEXT_LENGTH);
		if (!text.trim()) return null; // Skip empty messages

		return {
			type: 'message',
			id: message._id,
			text,
			metadata: {
				channelId: message.channelId,
				channelName,
				conversationId: message.conversationId,
				memberId: message.memberId,
				createdAt: message._creationTime,
			},
		};
	},
});

/**
 * Re-hydrates a task entity from the database and formats it as evidence.
 * Returns null if the task cannot be accessed or doesn't exist.
 */
export const hydrateTask = query({
	args: {
		taskId: v.id('tasks'),
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
	},
	handler: async (ctx, args): Promise<EvidenceItem | null> => {
		const task = await ctx.db.get(args.taskId);
		if (!task) return null;

		// Verify workspace matches
		if (task.workspaceId !== args.workspaceId) return null;

		const text = (
            task.title + (task.description ? `: ${task.description}` : '')
          ).slice(0, MAX_TEXT_LENGTH);
		if (!text.trim()) return null;

		return {
			type: 'task',
			id: task._id,
			text,
			metadata: {
				userId: task.userId,
				status: task.status || 'not_started',
				createdAt: task.createdAt,
			},
		};
	},
});

/**
 * Re-hydrates a note entity from the database and formats it as evidence.
 * Returns null if the note cannot be accessed or doesn't exist.
 */
export const hydrateNote = query({
	args: {
		noteId: v.id('notes'),
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
	},
	handler: async (ctx, args): Promise<EvidenceItem | null> => {
		const note = await ctx.db.get(args.noteId);
		if (!note) return null;

		// Verify workspace matches
		if (note.workspaceId !== args.workspaceId) return null;

		// Get channel info
		let channelName: string | undefined;
		if (note.channelId) {
			const channel = await ctx.db.get(note.channelId);
			channelName = channel?.name;
		}

		const text = (
            note.title + ': ' + extractTextFromRichText(note.content)
          ).slice(0, MAX_TEXT_LENGTH);
          
		if (!text.trim()) return null;

		return {
			type: 'note',
			id: note._id,
			text,
			metadata: {
				channelId: note.channelId,
				channelName,
				memberId: note.memberId,
				createdAt: note.createdAt,
			},
		};
	},
});

/**
 * Re-hydrates a card entity from the database and formats it as evidence.
 * Returns null if the card cannot be accessed or doesn't exist.
 */
export const hydrateCard = query({
	args: {
		cardId: v.id('cards'),
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
	},
	handler: async (ctx, args): Promise<EvidenceItem | null> => {
		const card = await ctx.db.get(args.cardId);
		if (!card) return null;

		// Get list and channel info
		const list = await ctx.db.get(card.listId);
		if (!list) return null;

		const channel = await ctx.db.get(list.channelId);
		if (!channel) return null;

		// Verify workspace matches
		if (channel.workspaceId !== args.workspaceId) return null;

		const text = (
            card.title + (card.description ? `: ${card.description}` : '')
          ).slice(0, MAX_TEXT_LENGTH);          
		if (!text.trim()) return null;

		return {
			type: 'card',
			id: card._id,
			text,
			metadata: {
				listName: list.title,
				channelId: channel._id,
				channelName: channel.name,
				createdAt: card._creationTime,
			},
		};
	},
});

