import { describe, expect, test } from "bun:test";
import { API_TOOL_FALLBACKS, filterToolsForQuery } from "./composio-config";

describe("API_TOOL_FALLBACKS", () => {
	test("does not use starred repositories as a fallback for listing the authenticated user's repositories", () => {
		expect(
			API_TOOL_FALLBACKS.GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER
		).not.toContain(
			"GITHUB_ACTIVITY_LIST_REPO_S_STARRED_BY_AUTHENTICATED_USER"
		);
	});
});

describe("filterToolsForQuery", () => {
	test("prefers the authenticated user repository list tool for 'my repos' queries", () => {
		const tools = [
			{
				name: "GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
				description: "List repositories for the authenticated user",
				app: "github",
				_isDashboardTool: true,
				_priority: 1,
			},
			{
				name: "GITHUB_FIND_REPOSITORIES",
				description: "Search public repositories by query",
				app: "github",
				_isDashboardTool: false,
				_priority: 3,
			},
			{
				name: "GITHUB_ACTIVITY_LIST_REPO_S_STARRED_BY_AUTHENTICATED_USER",
				description: "List repositories starred by the authenticated user",
				app: "github",
				_isDashboardTool: false,
				_priority: 3,
			},
		];

		const result = filterToolsForQuery(tools, "please list out my repos", {
			maxTools: 3,
		});

		expect(result[0]?.name).toBe(
			"GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER"
		);
	});
});
