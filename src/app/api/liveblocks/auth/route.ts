import { Liveblocks } from "@liveblocks/node";
import { type NextRequest, NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

const liveblocks = new Liveblocks({
	secret: process.env.LIVEBLOCKS_SECRET_KEY!,
});

export async function POST(req: NextRequest) {
	try {
		const body = await req.json();
		const { room } = body;

		if (!room) {
			return new NextResponse("Room ID is required", { status: 400 });
		}

		// Derive user info from server-side session (Convex)
		const user = await fetchQuery(api.users.current, {});
		if (!user || !user._id || !user.name) {
			console.error("Liveblocks auth: missing or unauthenticated user", {
				hasUser: !!user,
				hasId: !!user?._id,
				hasName: !!user?.name,
			});
			return new NextResponse("Missing or unauthenticated user", { status: 401 });
		}

		// Optionally, check room membership (e.g., workspace or channel membership)
		let isAllowed = true;
		let memberId = null;
		const workspaceMatch = /^workspace-(.+)$/.exec(room);
		if (workspaceMatch) {
			const workspaceId = workspaceMatch[1] as Id<"workspaces">;
			const member = await fetchQuery(api.members.current, { workspaceId });
			if (!member || member.userId !== user._id) {
				isAllowed = false;
			} else {
				memberId = member._id;
			}
		}

		if (!isAllowed) {
			console.error("Liveblocks auth: user not allowed in room", {
				userId: user._id,
				room,
			});
			return new NextResponse("Not allowed in this room", { status: 403 });
		}

		const finalUserInfo = {
			id: user._id,
			name: user.name,
			picture: user.image || null,
			memberId,
		};

		const session = liveblocks.prepareSession(user._id, {
			userInfo: finalUserInfo,
		});

		// Grant minimal required permission (FULL_ACCESS only if needed)
		session.allow(room, session.FULL_ACCESS);

		const { status, body: responseBody } = await session.authorize();
		return new Response(responseBody, { status });
	} catch (error) {
		console.error("Liveblocks auth error", { hasError: !!error });
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
