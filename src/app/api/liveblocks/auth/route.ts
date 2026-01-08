import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { Liveblocks } from "@liveblocks/node";
import { ConvexHttpClient } from "convex/browser";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

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

		const convex = getConvexClient();

		// Pass auth through to Convex so we can read the current user.
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

		let currentUser: { _id: string; name?: string; image?: string } | null =
			null;
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

		// Prefer Convex-authenticated identity so cursor labels show real usernames.
		// Fall back only if unauthenticated.
		const userId =
			currentUser?._id ??
			body.userId ??
			body.memberId ??
			`anon-${Date.now().toString(36)}`;

		const userName = currentUser?.name ?? body.userName ?? "User";

		// Don't use external placeholder URLs - let the Avatar component handle fallbacks
		const userAvatar = currentUser?.image ?? body.userAvatar ?? null;

		// Log the authentication request for debugging
		console.log("Liveblocks auth request:", { room, userId, userName });

		// Prepare user info for the session
		// Make sure to include the real user ID from Convex in the id field
		// This is crucial for mapping Liveblocks users to Convex users
		const userInfo = {
			id: userId,
			name: userName,
			picture: userAvatar,
		};

		// Create a Liveblocks session with the user ID and info
		const session = liveblocks.prepareSession(userId, {
			userInfo,
		});

		// Verify room ID is provided
		if (!room) {
			return new NextResponse("Room ID is required", { status: 400 });
		}

		// Allow full access to the room and enable persistence
		session.allow(room, session.FULL_ACCESS);

		// Enable room persistence - this ensures the canvas data is saved
		// even when all users leave the room
		// The FULL_ACCESS permission already includes storage persistence

		// Authorize the session
		console.log("Attempting to authorize Liveblocks session for room:", room);
		console.log("With user info:", userInfo);
		const { status, body: responseBody } = await session.authorize();

		// Log successful authentication
		console.log("Liveblocks auth successful:", { userId, room, status });
		console.log("Liveblocks auth response body:", responseBody);

		// Return the authorization response
		return new Response(responseBody, { status });
	} catch (error) {
		// Log any errors
		console.error("Liveblocks auth error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
