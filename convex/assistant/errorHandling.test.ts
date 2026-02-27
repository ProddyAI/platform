/**
 * Unit tests for assistant error categorization and user-facing messages.
 * Run with: bun test convex/assistant/errorHandling.test.ts
 */

import {
	categorizeError,
	formatUserFriendlyError,
	handleAssistantError,
} from "./errorHandling";

describe("categorizeError", () => {
	it("detects rate_limit", () => {
		expect(categorizeError(new Error("Rate limit exceeded"))).toBe(
			"rate_limit"
		);
		expect(categorizeError(new Error("429 Too Many Requests"))).toBe(
			"rate_limit"
		);
	});

	it("detects tool_failure", () => {
		expect(categorizeError(new Error("Tool execution failed"))).toBe(
			"tool_failure"
		);
		expect(categorizeError(new Error("Composio error"))).toBe("tool_failure");
	});

	it("detects context_too_large", () => {
		expect(categorizeError(new Error("Context length exceeded"))).toBe(
			"context_too_large"
		);
	});

	it("detects authentication", () => {
		expect(categorizeError(new Error("Unauthorized"))).toBe("authentication");
	});

	it("returns unknown for generic errors", () => {
		expect(categorizeError(new Error("Something broke"))).toBe("unknown");
	});
});

describe("formatUserFriendlyError", () => {
	it("returns non-empty messages for each category", () => {
		expect(formatUserFriendlyError(new Error("Rate limit"))).toBeTruthy();
		expect(formatUserFriendlyError(new Error("Tool failed"))).toBeTruthy();
		expect(formatUserFriendlyError(new Error("Random"))).toBeTruthy();
	});
});

describe("handleAssistantError", () => {
	it("returns shouldRetry and message", async () => {
		const r = await handleAssistantError(new Error("Rate limit"), {
			query: "test",
			attemptCount: 0,
		});
		expect(typeof r.shouldRetry).toBe("boolean");
		expect(typeof r.message).toBe("string");
		expect(r.message.length).toBeGreaterThan(0);
	});

	it("for unknown error returns shouldRetry false", async () => {
		const r = await handleAssistantError(new Error("Unknown error"), {
			query: "test",
			attemptCount: 0,
		});
		expect(r.shouldRetry).toBe(false);
	});
});
