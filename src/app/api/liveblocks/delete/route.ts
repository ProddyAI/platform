import { Liveblocks } from "@liveblocks/node";
import { type NextRequest, NextResponse } from "next/server";

// Initialize the Liveblocks client with your secret key
const liveblocks = new Liveblocks({
	secret: process.env.LIVEBLOCKS_SECRET_KEY || "",
});

export async function DELETE(request: NextRequest) {
	try {
		// Get the roomId from the query parameters
		const { searchParams } = new URL(request.url);
		const roomId = searchParams.get("roomId");

		// Validate the roomId
		if (!roomId) {
			return NextResponse.json(
				{ error: "Room ID is required" },
				{ status: 400 }
			);
		}

		// Delete the room using the Liveblocks API - passing roomId directly as string
		await liveblocks.deleteRoom(roomId);

		// Return a success response
		return NextResponse.json(
			{ success: true, message: `Room ${roomId} deleted successfully` },
			{ status: 200 }
		);
	} catch (error: unknown) {
		console.error("Error deleting Liveblocks room:", error);

		// Return an error response with properly typed error handling
		return NextResponse.json(
			{
				error: "Failed to delete room",
				details: error instanceof Error ? error.message : String(error),
			},
			{ status: 500 }
		);
	}
}
