import type { Id } from "../../../../convex/_generated/dataModel";

export interface Note {
	_id: Id<"notes">;
	_creationTime: number;
	title: string;
	content: string;
	memberId: Id<"members">;
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
	coverImage?: Id<"_storage">;
	icon?: string;
	createdAt: number;
	updatedAt: number;
}

export interface CreateNoteRequest {
	title: string;
	content: string;
	workspaceId: Id<"workspaces">;
	channelId: Id<"channels">;
	icon?: string;
	coverImage?: Id<"_storage">;
}

export interface UpdateNoteRequest {
	id: Id<"notes">;
	title?: string;
	content?: string;
	icon?: string;
	coverImage?: Id<"_storage">;
}
