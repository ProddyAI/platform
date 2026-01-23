import { Liveblocks } from "@liveblocks/node";
import { type NextRequest, NextResponse } from "next/server";

const liveblocks = new Liveblocks({
	secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { room, userId, memberId, userName, userAvatar, userInfo } = body;

		// REQUIRE real user info — no more random users
		if (!room) {
			return new NextResponse("Room ID is required", { status: 400 });
		}

		// Prefer explicit userInfo (sent by client), fallback to fields
		const finalUserInfo = userInfo || {
			id: userId,
			name: userName,
			picture: userAvatar || null,
			memberId: memberId || null,
		};

		if (!finalUserInfo?.id || !finalUserInfo?.name) {
			console.error("Missing Liveblocks user info:", body);
			return new NextResponse("Missing user info for Liveblocks", { status: 400 });
		}

		// session userId MUST be real Convex user id
		const session = liveblocks.prepareSession(finalUserInfo.id, {
			userInfo: finalUserInfo,
		});

		session.allow(room, session.FULL_ACCESS);

		const { status, body: responseBody } = await session.authorize();

		return new Response(responseBody, { status });
	} catch (error) {
		console.error("Liveblocks auth error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
