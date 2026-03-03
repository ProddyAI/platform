"use node";

import { Composio } from "@composio/core";
import { v } from "convex/values";
import { action } from "./_generated/server";

export const testDirectComposioCall = action({
	args: {
		entityId: v.string(),
	},
	handler: async (_ctx, { entityId }) => {
		try {
			if (!process.env.COMPOSIO_API_KEY) {
				return { error: "COMPOSIO_API_KEY not configured" };
			}

			const composio = new Composio({
				apiKey: process.env.COMPOSIO_API_KEY,
			});

			console.log("[testComposio] Testing direct Composio API call");
			console.log("[testComposio] EntityId:", entityId);

			// Try to execute an action directly using Composio's executeAction method
			try {
				const result = await (composio as any).executeAction(
					entityId,
					"GITHUB_GITHUB_API_ROOT",
					{},
					"text"
				);

				console.log(
					"[testComposio] Direct execute result:",
					JSON.stringify(result).substring(0, 500)
				);
				return { success: true, result };
			} catch (execError: any) {
				console.error("[testComposio] Execute error:", execError.message);
				return { error: execError.message, stack: execError.stack };
			}
		} catch (error: any) {
			console.error("[testComposio] Test failed:", error.message);
			return { error: error.message, stack: error.stack };
		}
	},
});
