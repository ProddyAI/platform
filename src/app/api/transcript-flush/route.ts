import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

const convex = new ConvexHttpClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export async function POST(req: Request) {
	try {
		const { roomId, workspaceId, transcriptChunk } = await req.json();

		if (!roomId || !workspaceId || !transcriptChunk) {
			return new NextResponse("Missing required fields", { status: 400 });
		}

		// We use a internal mutation or a regular mutation here.
		// Note: Since this is called from a beacon, we don't have the user's session context automatically 
		// in the same way as a client-side mutation. However, for a "best-effort" flush, 
		// we can attempt to call the mutation. 
		// For production hardening, you'd want to verify a session token here.
		
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
