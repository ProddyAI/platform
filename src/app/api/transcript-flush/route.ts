import { ConvexHttpClient } from "convex/browser";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
if (!convexUrl) {
	throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexHttpClient(convexUrl);

export async function POST(req: Request) {
	try {
		const { roomId, workspaceId, transcriptChunk } = await req.json();

		if (!roomId || !workspaceId || !transcriptChunk) {
			return new NextResponse("Missing required fields", { status: 400 });
		}

		// Forward authentication from cookies
		const cookieStore = await cookies();
		const token = cookieStore.get("convex-auth-session-token")?.value;
		
		if (token) {
			convex.setAuth(token);
		}

		await convex.mutation(api.meetingNotes.saveTranscript, {
			roomId,
			workspaceId,
			transcriptChunk,
		});

		return NextResponse.json({ success: true });
	} catch (error) {
		console.error("Transcript flush error:", error);
		return new NextResponse("Internal Server Error", { status: 500 });
	}
}
