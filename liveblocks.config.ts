import {
	createClient,
	type Json,
	type JsonObject,
	type LiveList,
	type LiveMap,
	type LiveObject,
} from "@liveblocks/client";
import { createLiveblocksContext, createRoomContext } from "@liveblocks/react";

import type { Color, Layer } from "./src/features/canvas/types/canvas";

const client = createClient({
	throttle: 16,
	authEndpoint: "/api/liveblocks/auth",
	async resolveUsers() {
		// Used only for Comments and Notifications. Return a list of user information
		// This info is used in comments, mentions etc.
		return [];
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
	cursor: {
		x: number;
		y: number;
		tool?: "pointer" | "laser";
		button?: "up" | "down";
	} | null;
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

type ExcalidrawSceneData = {
	// Stored as JSON for Liveblocks (Lson) compatibility.
	elements: Json[];
	appState: JsonObject;
	files: JsonObject;
	version: number;
};

// Optionally, Storage represents the shared document that persists in the
// Room, even after all users leave. Fields under Storage typically are
// LiveList, LiveMap, LiveObject instances, for which updates are
// automatically persisted and synced to all connected clients.
type Storage = {
	layers: LiveMap<string, LiveObject<Layer>>;
	layerIds: LiveList<string>;
	collaborativeNotes: LiveMap<string, LiveObject<CollaborativeNoteData>>;
	excalidraw?: LiveObject<ExcalidrawSceneData>;
	lastUpdate?: number; // Timestamp to force storage updates
};

// Optionally, UserMeta represents static/readonly metadata on each user, as
// provided by your own custom auth back end (if used). Useful for data that
// will not change during a session, like a user's name or avatar.
type UserMeta = {
	id?: string;
	info?: {
		name?: string;
		picture?: string;
	};
};

// Optionally, the type of custom events broadcast and listened to in this
// room. Use a union for multiple events. Must be JSON-serializable.
type RoomEvent =
	| {
			type: "excalidraw:delta";
			elements: Json[];
	  }
	| {
			type: "NOTIFICATION";
			message?: string;
	  };

// Optionally, when using Comments, ThreadMetadata represents metadata on
// each thread. Can only contain booleans, strings, and numbers.
export type ThreadMetadata = {
	x: number;
	y: number;
	resolved: boolean;
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
