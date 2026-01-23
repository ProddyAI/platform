import {
	createClient,
	type LiveList,
	type LiveMap,
	type LiveObject,
} from "@liveblocks/client";
import { createLiveblocksContext, createRoomContext } from "@liveblocks/react";

import type { Color, Layer } from "./src/features/canvas/types/canvas";

const client = createClient({
	throttle: 16,
	authEndpoint: async (room) => {
		// This function is called by Liveblocks to authenticate
		// We need to pass the current user info from the client
		const response = await fetch("/api/liveblocks/auth", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				room,
				// These will be set by the RoomProvider from window context
				...(window as any).__liveblocksUserInfo,
			}),
		});
		return await response.json();
	},
	async resolveUsers({ userIds }) {
		// Fetch user information from our API
		try {
			const response = await fetch("/api/liveblocks/users", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ userIds }),
			});

			if (!response.ok) {
				console.error("Failed to resolve users:", response.statusText);
				return [];
			}

			const users = await response.json();
			
			// Return users in the same order as userIds
			return userIds.map((userId) => {
				const user = users[userId];
				return user ? { name: user.name, avatar: user.avatar } : undefined;
			});
		} catch (error) {
			console.error("Error resolving users:", error);
			return [];
		}
	},
	async resolveMentionSuggestions() {
		// Used only for Comments. Return a list of userIds that match text.
		return [];
	},
	async resolveRoomsInfo() {
		// Used only for Comments and Notifications. Return a list of room information
		return [];
	},
});

// Presence represents the properties that exist on every user in the Room
// and that will automatically be kept in sync. Accessible through the
// `user.presence` property. Must be JSON-serializable.
type Presence = {
	cursor: { x: number; y: number } | null;
	selection: string[];
	pencilDraft: [x: number, y: number, pressure: number][] | null;
	penColor: Color | null;
	strokeWidth?: number;
	isEditing?: boolean;
	lastActivity?: number;
};

// Collaborative note data structure
type CollaborativeNoteData = {
	content: string;
	title: string;
	lastModified: number;
	lastModifiedBy: string;
};

// Optionally, Storage represents the shared document that persists in the
// Room, even after all users leave. Fields under Storage typically are
// LiveList, LiveMap, LiveObject instances, for which updates are
// automatically persisted and synced to all connected clients.
type Storage = {
	layers: LiveMap<string, LiveObject<Layer>>;
	layerIds: LiveList<string>;
	collaborativeNotes: LiveMap<string, LiveObject<CollaborativeNoteData>>;
	lastUpdate?: number; // Timestamp to force storage updates
};

// Optionally, UserMeta represents static/readonly metadata on each user, as
// provided by your own custom auth back end (if used). Useful for data that
// will not change during a session, like a user's name or avatar.
type UserMeta = {
	id: string; // Make id required
	info: {
		name: string; // Make name required
		picture?: string;
		memberId?: string;
	};
};

// Optionally, the type of custom events broadcast and listened to in this
// room. Use a union for multiple events. Must be JSON-serializable.
type RoomEvent = {
	// type: "NOTIFICATION",
	// ...
};

// Optionally, when using Comments, ThreadMetadata represents metadata on
// each thread. Can only contain booleans, strings, and numbers.
export type ThreadMetadata = {
	// resolved: boolean;
	// quote: string;
	// time: number;
};

// Room-level hooks, use inside `RoomProvider`
export const {
	suspense: {
		RoomProvider,
		useRoom,
		useMyPresence,
		useUpdateMyPresence,
		useSelf,
		useOthers,
		useOthersMapped,
		useOthersListener,
		useOthersConnectionIds,
		useOther,
		useBroadcastEvent,
		useEventListener,
		useErrorListener,
		useStorage,
		useHistory,
		useUndo,
		useRedo,
		useCanUndo,
		useCanRedo,
		useMutation,
		useStatus,
		useLostConnectionListener,
		useThreads,
		useCreateThread,
		useEditThreadMetadata,
		useCreateComment,
		useEditComment,
		useDeleteComment,
		useAddReaction,
		useRemoveReaction,
		useThreadSubscription,
		useMarkThreadAsRead,

		// These hooks can be exported from either context
		// useUser,
		// useRoomInfo
	},
} = createRoomContext<Presence, Storage, UserMeta, RoomEvent, ThreadMetadata>(
	client
);

// Project-level hooks, use inside `LiveblocksProvider`
export const {
	suspense: {
		LiveblocksProvider,
		useMarkInboxNotificationAsRead,
		useMarkAllInboxNotificationsAsRead,
		useInboxNotifications,
		useUnreadInboxNotificationsCount,

		// These hooks can be exported from either context
		useUser,
		useRoomInfo,
	},
} = createLiveblocksContext<UserMeta, ThreadMetadata>(client);
