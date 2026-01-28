import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

// Environment variable validation
const liveblocksSecret = process.env.LIVEBLOCKS_SECRET_KEY;
if (!liveblocksSecret) {
	throw new Error("LIVEBLOCKS_SECRET_KEY environment variable is required");
}

const liveblocks = new Liveblocks({
	secret: liveblocksSecret,
});

type LiveblocksAuthRequestBody = {
	room?: string;
	userId?: string;
	memberId?: string;
	userName?: string;
	userAvatar?: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

function readString(
	obj: Record<string, unknown>,
	key: string
): string | undefined {
	const value = obj[key];
	return typeof value === "string" ? value : undefined;
}

function readNullableString(
	obj: Record<string, unknown>,
	key: string
): string | null | undefined {
	const value = obj[key];
	if (value === null) return null;
	return typeof value === "string" ? value : undefined;
}

let cachedConvexClient: ConvexHttpClient | null = null;

function getConvexClient(): ConvexHttpClient {
	if (!cachedConvexClient) {
		if (!process.env.NEXT_PUBLIC_CONVEX_URL) {
			throw new Error(
				"NEXT_PUBLIC_CONVEX_URL environment variable is required"
			);
		}
		cachedConvexClient = new ConvexHttpClient(
			process.env.NEXT_PUBLIC_CONVEX_URL
		);
	}
	return cachedConvexClient;
}

export async function POST(req: NextRequest) {
	try {
		// Parse the request body
		const rawBody: unknown = await req.json();
		const body: LiveblocksAuthRequestBody = isRecord(rawBody)
			? {
					room: readString(rawBody, "room"),
					userId: readString(rawBody, "userId"),
					memberId: readString(rawBody, "memberId"),
					userName: readString(rawBody, "userName"),
					userAvatar: readNullableString(rawBody, "userAvatar"),
				}
			: {};

		const room = body.room;

		if (!room) {
			return new NextResponse("Room ID is required", { status: 400 });
		}

		const convex = getConvexClient();

		// Pass auth through to Convex so we can read the current user
		try {
			const token = convexAuthNextjsToken();
			if (token) {
				convex.setAuth(token);
			} else if (isAuthenticatedNextjs()) {
				console.warn(
					"[Liveblocks Auth] Authenticated session but no Convex token found"
				);
			}
		} catch (err) {
			if (isAuthenticatedNextjs()) {
				console.warn(
					"[Liveblocks Auth] Failed to read Convex auth token from request",
					err
				);
			}
		}

		// Fetch current user from Convex
		let currentUser: { _id: string; name?: string; image?: string } | null = null;
		try {
			const maybeUser: unknown = await convex.query(api.users.current, {});
			if (isRecord(maybeUser) && typeof maybeUser._id === "string") {
				const name = maybeUser.name;
				const image = maybeUser.image;
				currentUser = {
					_id: maybeUser._id,
					...(typeof name === "string" ? { name } : {}),
					...(typeof image === "string" ? { image } : {}),
				};
			} else {
				currentUser = null;
			}
		} catch (err) {
			console.warn("[Liveblocks Auth] Failed to fetch current user", err);
			currentUser = null;
		}

		// Require authenticated user
		if (!currentUser || !currentUser._id) {
			console.error("Liveblocks auth: missing or unauthenticated user");
			return new NextResponse("Unauthorized", { status: 401 });
		}

		// Fallback for missing name
		const userName = currentUser.name || (currentUser as any).email || "Anonymous User";

		// Authorization: check membership for workspace-*, canvas-*, and note-* rooms
		let isAllowed = false;
		let memberId: string | null = null;

		const workspaceMatch = /^workspace-(.+)$/.exec(room);
		const canvasMatch = /^canvas-(.+)$/.exec(room);
		const noteMatch = /^note-(.+)$/.exec(room);

		if (workspaceMatch) {
			// Workspace room: check direct membership
			const workspaceId = workspaceMatch[1] as Id<"workspaces">;
			const member: unknown = await convex.query(api.members.current, { workspaceId });
			if (isRecord(member) && member.userId === currentUser._id) {
				isAllowed = true;
				memberId = typeof member._id === "string" ? member._id : null;
			}
		} else if (canvasMatch) {
			// Canvas room: resolve workspaceId via channelId
			// Canvas roomId format: canvas-{channelId}-{timestamp}
			const channelTimestampMatch = /^(.+?)-(\d+)$/.exec(canvasMatch[1]);
			if (channelTimestampMatch && channelTimestampMatch[1]) {
				const channelId = channelTimestampMatch[1] as Id<"channels">;
				const channel: unknown = await convex.query(api.channels.getById, { id: channelId });
				if (isRecord(channel) && typeof channel.workspaceId === "string") {
					const workspaceId = channel.workspaceId as Id<"workspaces">;
					const member: unknown = await convex.query(api.members.current, { workspaceId });
					if (isRecord(member) && member.userId === currentUser._id) {
						isAllowed = true;
						memberId = typeof member._id === "string" ? member._id : null;
					}
				}
			}
		} else if (noteMatch) {
			// Note room: resolve workspaceId via noteId
			// Note roomId format: note-{noteId}
			const noteId = noteMatch[1] as Id<"notes">;
			const note: unknown = await convex.query(api.notes.getById, { noteId });
			if (isRecord(note) && typeof note.workspaceId === "string") {
				const workspaceId = note.workspaceId as Id<"workspaces">;
				const member: unknown = await convex.query(api.members.current, { workspaceId });
				if (isRecord(member) && member.userId === currentUser._id) {
					isAllowed = true;
					memberId = typeof member._id === "string" ? member._id : null;
				}
			}
		}

		if (!isAllowed) {
			console.error("Liveblocks auth: user not allowed in room", {
				userId: currentUser._id,
				room,
			});
			return new NextResponse("Forbidden", { status: 403 });
		}

		// Prepare user info for Liveblocks session
		const userInfo = {
			id: currentUser._id,
			name: userName,
			picture: currentUser.image || null,
			memberId,
		};

		// Create Liveblocks session with real user identity
		const session = liveblocks.prepareSession(currentUser._id, {
			userInfo,
		});

		// Grant full access for collaborative editing
		session.allow(room, session.FULL_ACCESS);

		const { status, body: responseBody } = await session.authorize();
		return new Response(responseBody, { status });
	} catch (error) {
		console.error("Liveblocks auth error", {
			message: error instanceof Error ? error.message : String(error),
			name: error instanceof Error ? error.name : undefined,
		});
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}