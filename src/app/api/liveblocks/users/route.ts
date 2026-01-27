import { fetchQuery } from "convex/nextjs";
import { type NextRequest, NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";
import type { Id } from "@/../convex/_generated/dataModel";

export async function POST(req: NextRequest) {
	try {
		const authUser = await fetchQuery(api.users.current, {});
		if (!authUser) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const { userIds } = await req.json();

		if (!Array.isArray(userIds) || userIds.length === 0) {
			return NextResponse.json({});
		}

		const users: Record<string, { name: string; avatar?: string } | undefined> = {};

		// Fetch all users in parallel
		const results = await Promise.allSettled(
			userIds.map(async (userId: string) => {
				const user = await fetchQuery(api.users.getUserById, { id: userId as Id<"users"> });
				return { userId, user };
			})
		);

		for (const result of results) {
			if (result.status === "fulfilled" && result.value.user) {
				const { userId, user } = result.value;
				users[userId] = {
					name: user.name || "Unknown User",
					avatar: user.image || undefined,
				};
			} else if (result.status === "rejected") {
				console.error(`Failed to fetch user:`, result.reason);
			}
		}

		return NextResponse.json(users);
	} catch (error) {
		console.error("Error resolving Liveblocks users:", error);
		const errorMessage = (error && typeof error === "object" && "message" in error)
			? (error as Error).message
			: String(error);
		return NextResponse.json(
			{ error: "Failed to resolve Liveblocks users", details: errorMessage },
			{ status: 500 }
		);
	}
}