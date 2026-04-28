"use node";

import { StreamClient } from "@stream-io/node-sdk";
import { action } from "./_generated/server";

export const createStreamToken = action({
	args: {},
	handler: async (ctx): Promise<{ token: string; userId: string; apiKey: string }> => {
		const identity = await ctx.auth.getUserIdentity();
		if (!identity) {
			throw new Error("Unauthorized");
		}

		const apiKey = process.env.STREAM_API_KEY;
		const secret = process.env.STREAM_SECRET;

		if (!apiKey || !secret) {
			throw new Error("Stream environment variables are not configured");
		}

		const rawId = identity.subject;
		const userId = rawId.toLowerCase().replace(/[^a-z0-9@_.-]/g, "_");
		const client = new StreamClient(apiKey, secret);
		const token = client.generateUserToken({ user_id: userId });

		return { token, userId, apiKey };
	},
});
