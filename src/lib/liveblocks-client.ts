// Define Liveblocks types and client for the application
import { createClient } from "@liveblocks/client";
import { createRoomContext } from "@liveblocks/react";

// Define the shapes in your whiteboard
export type Point = {
	x: number;
	y: number;
};

// Define the cursor position type
export type Cursor = {
	x: number;
	y: number;
};

export type Stroke = {
	points: Point[];
	color: string;
	size: number;
};

export type Shape = {
	type: "rectangle" | "circle" | "line" | "arrow";
	x: number;
	y: number;
	width?: number;
	height?: number;
	color: string;
	strokeWidth: number;
	startPoint?: Point;
	endPoint?: Point;
	radius?: number;
};

export type Text = {
	x: number;
	y: number;
	content: string;
	color: string;
	fontSize: number;
};

export type ActiveUser = {
	id: string;
	name: string;
	avatar?: string;
	tool?: string;
	color?: string;
	joinedAt: number;
};

// Use the API key from your environment variables
const client = createClient({
	authEndpoint: "/api/liveblocks/auth",
	throttle: 16,
});

// Define your Liveblocks types
declare global {
	interface Liveblocks {
		// Each user's Presence, for useMyPresence, useOthers, etc.
		Presence: {
			cursor: Cursor | null;
			selectedTool: string | null;
			selectedColor: string | null;
			isDrawing: boolean;
			userName?: string;
			userAvatar?: string;
			joinedAt?: number;
		};

		// The Storage tree for the room, for useMutation, useStorage, etc.
		Storage: {
			strokes: Stroke[];
			shapes: Shape[];
			texts: Text[];
			canvasBackground: string;
			activeUsers?: any[];
		};

		// Custom user info set when authenticating with a secret key
		UserMeta: {
			id: string;
			info: {
				name: string;
				avatar?: string;
			};
		};

		// Custom events, for useBroadcastEvent, useEventListener
		RoomEvent: { type: "CLEAR_CANVAS" } | { type: "UNDO" } | { type: "REDO" };

		// Custom metadata set on threads, for useThreads, useCreateThread, etc.
		ThreadMetadata: {
			x: number;
			y: number;
			resolved: boolean;
		};
	}
}

// Create the room context
export const {
	RoomProvider,
	useOthers,
	useUpdateMyPresence,
	useOthersMapped,
	useBroadcastEvent,
	useEventListener,
	useRoom,
	useMyPresence,
	useStorage,
	useMutation,
	useThreads,
	useCreateThread,
	useErrorListener,
	useRedo,
	useUndo,
	useCanRedo,
	useCanUndo,
} = createRoomContext(client);
