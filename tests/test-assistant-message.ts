#!/usr/bin/env tsx

/**
 * Test Assistant Message
 * Sends a test message to the assistant to verify the fix
 */

import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";

const client = new ConvexHttpClient(process.env.CONVEX_URL || "http://localhost:8000");

async function testAssistant() {
	console.log("🧪 Testing Assistant Message\n");
	console.log("=".repeat(60));

	try {
		// Send a message to the assistant
		const result = await client.mutation(api.assistantChat.sendMessage, {
			conversationId: "test-conv-001",
			message: "What's on my calendar today?",
		});

		console.log("\n✅ Message sent successfully!");
		console.log("\nResponse:", JSON.stringify(result, null, 2));

		if (result.success) {
			console.log("\n🎉 Assistant responded without errors!");
		} else {
			console.log("\n❌ Assistant returned error:", result.error);
		}
	} catch (error: any) {
		console.error("\n❌ Error:", error.message);
		process.exit(1);
	}

	console.log("\n" + "=".repeat(60));
}

testAssistant();
