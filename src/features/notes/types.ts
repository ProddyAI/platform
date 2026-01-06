import type { Id } from "@/../convex/_generated/dataModel";

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
	tags?: string[];
	createdAt: number;
	updatedAt: number;
}
