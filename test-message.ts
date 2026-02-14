#!/usr/bin/env tsx

import { ConvexHttpClient } from "convex/browser";
import { api } from "./convex/_generated/api";

// Use the cloud deployment
const deploymentUrl = process.env.NEXT_PUBLIC_CONVEX_URL || "https://friendly-marmot-282.convex.cloud";
const client = new ConvexHttpClient(deploymentUrl);

async function sendMessage() {
	try {
		console.log("\n📨 Sending message to assistant...");
		console.log(`🌐 Using deployment: ${deploymentUrl}\n`);
		
		const result = await client.action(api.assistantChat.sendMessage, {
			conversationId: "test-conv-" + Date.now(),
			message: "What's on my calendar today?",
		});

		console.log("\n✅ Response received:");
		console.log(JSON.stringify(result, null, 2));
		process.exit(result.success ? 0 : 1);
	} catch (error: any) {
		console.error("\n❌ Error:", error);
		process.exit(1);
	}
}

sendMessage();
