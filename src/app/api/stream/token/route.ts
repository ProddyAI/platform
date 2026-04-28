import {
	convexAuthNextjsToken,
	isAuthenticatedNextjs,
} from "@convex-dev/auth/nextjs/server";
import { StreamClient } from "@stream-io/node-sdk";
import { ConvexHttpClient } from "convex/browser";
import { NextResponse } from "next/server";
import { api } from "@/../convex/_generated/api";

export const dynamic = "force-dynamic";

type CurrentUser = {
	_id?: string;
	name?: string;
	image?: string;
};

function createConvexClient() {
	const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL;
	if (!convexUrl) {
		return null;
	}

	return new ConvexHttpClient(convexUrl);
}

export async function GET() {
	try {
		if (!(await isAuthenticatedNextjs())) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const apiKey = process.env.STREAM_API_KEY;
		const apiSecret = process.env.STREAM_API_SECRET;

		if (!apiKey || !apiSecret) {
			return NextResponse.json(
				{ error: "Stream is not configured" },
				{ status: 500 }
			);
		}

		const convex = createConvexClient();
		if (!convex) {
			return NextResponse.json(
				{ error: "Authentication is not configured" },
				{ status: 500 }
			);
		}

		const authToken = await convexAuthNextjsToken();
		if (!authToken || typeof authToken !== "string") {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		convex.setAuth(authToken);
		const user = (await convex.query(api.users.current, {})) as CurrentUser | null;

		if (!user?._id) {
			return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
		}

		const streamClient = new StreamClient(apiKey, apiSecret);
		const token = streamClient.generateUserToken({ user_id: user._id });

		return NextResponse.json({
			token,
			userId: user._id,
			name: user.name,
			image: user.image,
		});
	} catch (error) {
		console.error("[Stream Token] Failed to create token", error);
		return NextResponse.json(
			{ error: "Failed to create meeting token" },
			{ status: 500 }
		);
	}
}
