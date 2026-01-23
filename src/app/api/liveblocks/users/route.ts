import { fetchQuery } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

export async function POST(req: NextRequest) {
	try {
		const { userIds } = await req.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return NextResponse.json({});
		}

		const users: Record<string, { name: string; avatar?: string } | undefined> = {};

		// Fetch each user from Convex
		for (const userId of userIds) {
			try {
				const user = await fetchQuery(api.users.getUserById, { id: userId });
				
				if (user) {
					users[userId] = {
						name: user.name || "Unknown User",
						avatar: user.image || undefined,
					};
				}
			} catch (error) {
				console.error(`Failed to fetch user ${userId}:`, error);
				// Return undefined for this user
				users[userId] = undefined;
			}
		}

		return NextResponse.json(users);
	} catch (error) {
		console.error("Error resolving Liveblocks users:", error);
		return NextResponse.json({}, { status: 500 });
	}
}