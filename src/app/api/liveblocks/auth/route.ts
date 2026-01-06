import { Liveblocks } from "@liveblocks/node";
import { type NextRequest, NextResponse } from "next/server";

const liveblocks = new Liveblocks({
	secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: NextRequest) {
	try {
		// Parse the request body
		const body = await req.json();
		const { room } = body;

		// Get user information from the request
		// Use the member ID from the workspace if available, otherwise use a fallback
		// This ensures a consistent identity across sessions
		const userId =
			body.userId || body.memberId || `user-${Date.now().toString(36)}`;
		const userName = body.userName || `User ${userId.substring(5)}`;
		// Don't use external placeholder URLs - let the Avatar component handle fallbacks
		const userAvatar = body.userAvatar || null;

		// Log the authentication request for debugging
		console.log("Liveblocks auth request:", { room, userId, userName });

		// Prepare user info for the session
		// Make sure to include the real user ID from Convex in the id field
		// This is crucial for mapping Liveblocks users to Convex users
		const userInfo = body.userInfo || {
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
