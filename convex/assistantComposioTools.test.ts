import { describe, expect, test } from "bun:test";
import {
	isAuthenticatedRepoListRequest,
	isStarredRepoListRequest,
	normalizeGithubInstruction,
} from "./assistantComposioTools";

describe("GitHub repo instruction normalization", () => {
	test("normalizes owned repository listing requests", () => {
		expect(normalizeGithubInstruction("list out my repositories")).toBe(
			"List repositories for the authenticated user. Do not list starred repositories. Do not search public repositories."
		);
	});

	test("normalizes starred repository listing requests", () => {
		expect(
			normalizeGithubInstruction("what about my starred repositories")
		).toBe(
			"List repositories starred by the authenticated user. Do not list owned repositories unless the user asks for them."
		);
	});

	test("detects owned and starred repository requests separately", () => {
		expect(isAuthenticatedRepoListRequest("list my repos")).toBe(true);
		expect(isAuthenticatedRepoListRequest("list my starred repositories")).toBe(
			false
		);
		expect(isStarredRepoListRequest("list my starred repositories")).toBe(true);
	});
});
