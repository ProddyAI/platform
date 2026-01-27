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


		// Authorization: check membership for workspace-*, canvas-*, and note-* rooms
		let isAllowed = true;
		let memberId = null;
		const workspaceMatch = /^workspace-(.+)$/.exec(room);
		const canvasMatch = /^canvas-(.+)$/.exec(room);
		const noteMatch = /^note-(.+)$/.exec(room);

		if (workspaceMatch) {
			// Workspace room: check direct membership
			const workspaceId = workspaceMatch[1] as Id<"workspaces">;
			const member = await fetchQuery(api.members.current, { workspaceId });
			if (!member || member.userId !== user._id) {
				isAllowed = false;
			} else {
				memberId = member._id;
			}
		} else if (canvasMatch) {
			// Canvas room: resolve workspaceId via channelId in the canvasId
			// Canvas roomId format: canvas-{channelId}-{timestamp}
			const canvasIdParts = canvasMatch[1].split("-");
			const channelId = canvasIdParts[0] as Id<"channels">;
			// Fetch channel to get workspaceId
			const channel = await fetchQuery(api.channels.getById, { id: channelId });
			if (channel && channel.workspaceId) {
				const workspaceId = channel.workspaceId as Id<"workspaces">;
				const member = await fetchQuery(api.members.current, { workspaceId });
				if (!member || member.userId !== user._id) {
					isAllowed = false;
				} else {
					memberId = member._id;
				}
			} else {
				isAllowed = false;
			}
		} else if (noteMatch) {
			// Note room: resolve workspaceId via noteId
			// Note roomId format: note-{noteId}
			const noteId = noteMatch[1] as Id<"notes">;
			// Fetch note to get workspaceId
			const note = await fetchQuery(api.notes.getById, { noteId });
			if (note && note.workspaceId) {
				const workspaceId = note.workspaceId as Id<"workspaces">;
				const member = await fetchQuery(api.members.current, { workspaceId });
				if (!member || member.userId !== user._id) {
					isAllowed = false;
				} else {
					memberId = member._id;
				}
			} else {
				isAllowed = false;
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

		// Grant FULL_ACCESS for collaborative editing capabilities
		session.allow(room, session.FULL_ACCESS);

		const { status, body: responseBody } = await session.authorize();
		return new Response(responseBody, { status });
	} catch (error) {
		console.error("Liveblocks auth error", { hasError: !!error });
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
