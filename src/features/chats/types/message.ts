import type { Doc, Id } from "../../../../convex/_generated/dataModel";

export interface MessageProps {
	id: Id<"messages">;
	memberId: Id<"members">;
	authorName?: string;
	authorImage?: string;
	isAuthor: boolean;
	reactions: Array<
		Omit<Doc<"reactions">, "memberId"> & {
			count: number;
			memberIds: Id<"members">[];
		}
	>;
	body: Doc<"messages">["body"];
	image: string | null | undefined;
	createdAt: Doc<"messages">["_creationTime"];
	updatedAt: Doc<"messages">["updatedAt"];
	isEditing: boolean;
	isCompact?: boolean;
	setEditingId: (id: Id<"messages"> | null) => void;
	hideThreadButton?: boolean;
	threadCount?: number;
	threadImage?: string;
	threadName?: string;
	threadTimestamp?: number;
	calendarEvent?: {
		date: number;
		time?: string;
	};
}

export interface ContextMenuState {
	show: boolean;
	x: number;
	y: number;
	messageId?: Id<"messages">;
}

export interface TaskModalState {
	show: boolean;
	title: string;
	content: string;
	dueDate: string;
}
