/**
 * Linear Import Provider
 *
 * Implements import pipeline for Linear following the same architecture as Slack import.
 * Handles teams, projects, issues, and comments import.
 */

import { internal } from "./_generated/api";
import {
	chunkArray,
	formatDuration,
	generateIdempotencyKey,
	type ImportContext,
	type ImportPlatform,
	type ImportResult,
	RateLimiter,
	type WorkspaceMetadata,
	withRetry,
} from "./importPipeline";

// ============================================================================
// LINEAR GRAPHQL TYPES
// ============================================================================

interface LinearTeam {
	id: string;
	name: string;
	key: string;
}

interface LinearProject {
	id: string;
	name: string;
	teamId?: string;
	teams?: { nodes: Array<{ id: string }> };
}

interface LinearIssue {
	id: string;
	title: string;
	description?: string;
	teamId: string;
	projectId?: string;
	stateId: string;
	assigneeId?: string;
	creatorId: string;
	priority: number;
	createdAt: string;
	updatedAt: string;
	completedAt?: string;
	number: number;
	identifier: string;
}

interface LinearIssueComment {
	id: string;
	body: string;
	userId: string;
	createdAt: string;
	issueId: string;
}

interface LinearUser {
	id: string;
	name: string;
	email: string;
	avatarUrl?: string;
}

interface LinearGraphQLResponse<T> {
	data?: T;
	errors?: Array<{ message: string }>;
}

// ============================================================================
// LINEAR IMPORT PROVIDER CLASS
// ============================================================================

export class LinearImportProvider {
	readonly platform: ImportPlatform = "linear";

	private rateLimiter: RateLimiter;
	private static readonly ITEMS_PER_PAGE = 100;
	public static readonly ISSUE_BATCH_SIZE = 50;

	constructor() {
		this.rateLimiter = new RateLimiter({
			minDelay: 100,
			maxDelay: 30000,
		});
	}

	/**
	 * Make an authenticated Linear GraphQL API call
	 */
	private async graphqlCall<T>(
		ctx: ImportContext,
		query: string,
		variables?: Record<string, unknown>
	): Promise<T> {
		return withRetry(
			async () => {
				if (await ctx.isCancelled()) {
					throw new Error("Import cancelled");
				}

				await this.rateLimiter.wait();

				const response = await fetch("https://api.linear.app/graphql", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${ctx.accessToken}`,
					},
					body: JSON.stringify({ query, variables }),
				});

				if (!response.ok) {
					const errorText = await response.text();
					if (response.status === 429) {
						this.rateLimiter.recordRateLimit(60);
						throw new Error(`Rate limited: ${errorText}`);
					}
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = (await response.json()) as LinearGraphQLResponse<T>;

				if (data.errors) {
					throw new Error(`GraphQL error: ${data.errors[0].message}`);
				}

				if (!data.data) {
					throw new Error("Empty response from Linear");
				}

				this.rateLimiter.recordSuccess();
				return data.data as T;
			},
			{
				maxAttempts: 5,
				initialDelay: 1000,
				maxDelay: 30000,
			},
			async (attempt, error, delay) => {
				await ctx.log("warn", `Linear API retry ${attempt}/5`, {
					error: error.message,
					delayMs: delay,
				});
			}
		);
	}

	/**
	 * Validate the Linear connection
	 */
	async validateConnection(ctx: ImportContext): Promise<void> {
		try {
			await this.graphqlCall<{ organization: { id: string; name: string } }>(
				ctx,
				`{ organization { id name } }`
			);
		} catch (error) {
			throw new Error(
				`Failed to validate Linear connection: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Fetch workspace metadata
	 */
	async fetchWorkspace(ctx: ImportContext): Promise<WorkspaceMetadata> {
		const result = await this.graphqlCall<{
			organization: { id: string; name: string };
		}>(ctx, `{ organization { id name } }`);

		return {
			externalId: result.organization.id,
			name: result.organization.name,
			metadata: {},
		};
	}

	/**
	 * Fetch all teams
	 */
	async fetchTeams(ctx: ImportContext): Promise<LinearTeam[]> {
		const result = await this.graphqlCall<{ teams: { nodes: LinearTeam[] } }>(
			ctx,
			`{ teams { nodes { id name key } } }`
		);

		return result.teams.nodes;
	}

	/**
	 * Fetch all projects
	 */
	async fetchProjects(ctx: ImportContext): Promise<LinearProject[]> {
		const result = await this.graphqlCall<{
			projects: { nodes: LinearProject[] };
		}>(ctx, `{ projects { nodes { id name teams { nodes { id } } } } }`);

		// Transform to include teamId from first team
		return result.projects.nodes.map((project) => ({
			id: project.id,
			name: project.name,
			teamId: project.teams?.nodes?.[0]?.id || "",
		}));
	}

	/**
	 * Fetch all issues with pagination
	 */
	async fetchAllIssues(ctx: ImportContext): Promise<LinearIssue[]> {
		const allIssues: LinearIssue[] = [];
		let cursor: string | undefined;

		do {
			const result = await this.graphqlCall<{
				issues: {
					nodes: Array<{
						id: string;
						title: string;
						description?: string;
						createdAt: string;
						updatedAt: string;
						completedAt?: string;
						number: number;
						identifier: string;
						priority: number;
						team?: { id: string };
						project?: { id: string };
						state?: { id: string };
						assignee?: { id: string };
						creator?: { id: string };
					}>;
					pageInfo: { hasNextPage: boolean; endCursor?: string };
				};
			}>(
				ctx,
				`query Issues($first: Int!, $after: String) {
					issues(first: $first, after: $after) {
						nodes {
							id title description
							createdAt updatedAt completedAt number identifier priority
							team { id }
							project { id }
							state { id }
							assignee { id }
							creator { id }
						}
						pageInfo { hasNextPage endCursor }
					}
				}`,
				{ first: LinearImportProvider.ITEMS_PER_PAGE, after: cursor }
			);

			// Transform nested objects to IDs
			const issues = result.issues.nodes.map((issue) => ({
				id: issue.id,
				title: issue.title,
				description: issue.description,
				teamId: issue.team?.id || "",
				projectId: issue.project?.id,
				stateId: issue.state?.id || "",
				assigneeId: issue.assignee?.id,
				creatorId: issue.creator?.id || "",
				priority: issue.priority,
				createdAt: issue.createdAt,
				updatedAt: issue.updatedAt,
				completedAt: issue.completedAt,
				number: issue.number,
				identifier: issue.identifier,
			}));

			allIssues.push(...issues);
			cursor = result.issues.pageInfo.hasNextPage
				? result.issues.pageInfo.endCursor
				: undefined;
		} while (cursor);

		// Filter by completed status if configured
		if (!ctx.config.includeArchived) {
			return allIssues.filter((issue) => !issue.completedAt);
		}

		return allIssues;
	}

	/**
	 * Fetch comments for an issue
	 */
	async fetchIssueComments(
		ctx: ImportContext,
		issueId: string
	): Promise<LinearIssueComment[]> {
		try {
			const result = await this.graphqlCall<{
				issue?: {
					comments: { nodes: LinearIssueComment[] };
				};
			}>(
				ctx,
				`query IssueComments($issueId: String!) {
					issue(id: $issueId) {
						comments {
							nodes {
								id
								body
								createdAt
								user { id }
							}
						}
					}
				}`,
				{ issueId }
			);

			return result.issue?.comments?.nodes || [];
		} catch (error) {
			ctx.log("warn", `Failed to fetch comments for issue ${issueId}`, error);
			return [];
		}
	}

	/**
	 * Fetch users
	 */
	async fetchUsers(ctx: ImportContext): Promise<LinearUser[]> {
		const result = await this.graphqlCall<{ users: { nodes: LinearUser[] } }>(
			ctx,
			`{ users { nodes { id name email avatarUrl } } }`
		);

		return result.users.nodes;
	}
}

/**
 * Import context extended with Linear-specific tracking
 */
interface LinearImportContext extends ImportContext {
	teamMap: Map<string, string>;
	projectMap: Map<string, string>;
	issueMap: Map<string, string>;
	userMap: Map<string, string>;
}

/**
 * Execute a Linear import
 */
export async function executeLinearImport(
	ctx: ImportContext,
	provider: LinearImportProvider
): Promise<ImportResult> {
	const startTime = Date.now();
	const result: ImportResult = {
		itemsCreated: [],
		messagesCreated: 0,
		usersMatched: 0,
		filesImported: 0,
		errors: [],
		warnings: [],
	};

	const linearCtx: LinearImportContext = {
		...ctx,
		teamMap: new Map(),
		projectMap: new Map(),
		issueMap: new Map(),
		userMap: new Map(),
	};

	try {
		// Step 1: Validate connection
		await ctx.updateProgress({
			currentStep: "Validating Linear connection...",
		});
		await provider.validateConnection(ctx);

		// Step 2: Fetch workspace info
		await ctx.updateProgress({ currentStep: "Fetching workspace info..." });
		const _workspace = await provider.fetchWorkspace(ctx);

		// Step 3: Fetch users
		await ctx.updateProgress({ currentStep: "Fetching users..." });
		const users = await provider.fetchUsers(ctx);
		result.usersMatched = users.length;
		users.forEach((user) => {
			linearCtx.userMap.set(user.id, user.name);
		});
		await ctx.log("info", `Fetched ${users.length} users`);

		// Step 4: Fetch teams
		await ctx.updateProgress({ currentStep: "Fetching teams..." });
		const teams = await provider.fetchTeams(ctx);
		await ctx.log("info", `Fetched ${teams.length} teams`);

		// Step 5: Fetch projects
		await ctx.updateProgress({ currentStep: "Fetching projects..." });
		const projects = await provider.fetchProjects(ctx);
		await ctx.log("info", `Fetched ${projects.length} projects`);

		if (teams.length === 0 && projects.length === 0) {
			await ctx.updateProgress({
				currentStep: "No teams or projects found",
				itemsTotal: 0,
			});
			return result;
		}

		// Step 6: Process teams as channels
		await ctx.updateProgress({
			currentStep: "Importing teams...",
			itemsTotal: teams.length,
			itemsImported: 0,
		});

		for (const [index, team] of teams.entries()) {
			if (await ctx.isCancelled()) throw new Error("Import cancelled");

			try {
				const channelId = await storeTeam(linearCtx, team);
				linearCtx.teamMap.set(team.id, channelId);
				result.itemsCreated.push(channelId);

				await ctx.updateProgress({
					itemsImported: index + 1,
					currentStep: `Processed ${index + 1}/${teams.length} teams`,
				});
			} catch (error) {
				const errorMsg = `Failed to process team ${team.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
				result.errors?.push(errorMsg);
				await ctx.log("error", errorMsg, error);
			}
		}

		// Step 7: Fetch and process issues
		await ctx.updateProgress({ currentStep: "Fetching issues..." });
		const issues = await provider.fetchAllIssues(ctx);

		await ctx.updateProgress({
			subItemsTotal: issues.length,
			currentStep: `Found ${issues.length} issues`,
		});
		await ctx.log("info", `Fetched ${issues.length} issues`);

		// Process issues in batches
		const issueBatches = chunkArray(
			issues,
			LinearImportProvider.ISSUE_BATCH_SIZE
		);

		for (const [_batchIndex, issueBatch] of issueBatches.entries()) {
			if (await ctx.isCancelled()) throw new Error("Import cancelled");

			for (const issue of issueBatch) {
				try {
					await storeIssue(linearCtx, provider, issue, result);
				} catch (error) {
					const errorMsg = `Failed to process issue ${issue.identifier}: ${error instanceof Error ? error.message : "Unknown error"}`;
					result.errors?.push(errorMsg);
					await ctx.log("error", errorMsg, error);
				}
			}

			await ctx.updateProgress({
				subItemsImported: result.messagesCreated,
				currentStep: `Processed ${result.messagesCreated}/${issues.length} issues`,
			});
		}

		// Step 8: Final summary
		const duration = Date.now() - startTime;
		await ctx.updateProgress({
			currentStep: `Import completed in ${formatDuration(duration)}`,
		});

		await ctx.log("info", "Linear import completed", {
			duration: formatDuration(duration),
			teams: result.itemsCreated.length,
			issues: result.messagesCreated,
			users: result.usersMatched,
			errors: result.errors?.length || 0,
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		result.errors?.push(`Import failed: ${errorMsg}`);
		await ctx.log("error", "Linear import failed", error);
		throw error;
	}

	return result;
}

/**
 * Store a team in the database (idempotent)
 */
async function storeTeam(
	ctx: LinearImportContext,
	team: LinearTeam
): Promise<string> {
	const idempotencyKey = generateIdempotencyKey(
		"linear",
		ctx.workspaceId,
		team.id,
		"channel"
	);

	const existingChannel = (await ctx.runQuery(
		internal.importIntegrations.getChannelByExternalId,
		{ workspaceId: ctx.workspaceId, externalId: team.id }
	)) as any;

	if (existingChannel) {
		if (existingChannel.name !== team.name) {
			await ctx.runMutation(
				internal.importIntegrations.updateImportedChannelName,
				{
					channelId: existingChannel._id,
					name: team.name,
				}
			);
		}
		ctx.teamMap.set(team.id, existingChannel._id);
		return existingChannel._id;
	}

	const channelId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedChannel,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			externalId: team.id,
			idempotencyKey,
			name: team.name,
			type: "team",
			metadata: { key: team.key },
		}
	);

	return channelId;
}

/**
 * Store an issue in the database (idempotent)
 */
async function storeIssue(
	ctx: LinearImportContext,
	provider: LinearImportProvider,
	issue: LinearIssue,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"linear",
		ctx.workspaceId,
		issue.id,
		"message"
	);

	const existingMessage = (await ctx.runQuery(
		internal.importIntegrations.getMessageByExternalId,
		{ workspaceId: ctx.workspaceId, externalId: issue.id }
	)) as any;

	if (existingMessage) {
		ctx.issueMap.set(issue.id, existingMessage._id);
		return;
	}

	// Get channel ID from team map
	const channelId = ctx.teamMap.get(issue.teamId);
	if (!channelId) {
		const warning = `Team not found for issue ${issue.identifier}: teamId=${issue.teamId}, availableTeams=${Array.from(ctx.teamMap.keys()).join(", ")}`;
		result.warnings?.push(warning);
		await ctx.log("warn", warning);
		return;
	}

	// Build issue content
	let body = `**${issue.identifier}**: ${issue.title}`;
	if (issue.description) {
		body += `\n\n${issue.description}`;
	}

	const messageId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedMessage,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			channelId: channelId as any,
			externalId: issue.id,
			idempotencyKey,
			body,
			timestamp: new Date(issue.createdAt).getTime(),
			metadata: {
				identifier: issue.identifier,
				priority: issue.priority,
				stateId: issue.stateId,
				projectId: issue.projectId,
				assigneeId: issue.assigneeId,
				creatorId: issue.creatorId,
				isCompleted: !!issue.completedAt,
				completedAt: issue.completedAt,
			},
		}
	);

	ctx.issueMap.set(issue.id, messageId);
	result.messagesCreated++;

	// Fetch and store comments if enabled
	if (ctx.config.includeComments) {
		try {
			const comments = await provider.fetchIssueComments(ctx, issue.id);
			for (const comment of comments) {
				await storeComment(ctx, messageId, comment, result);
			}
		} catch (error) {
			const errorMsg = `Failed to fetch comments for issue ${issue.identifier}: ${error instanceof Error ? error.message : "Unknown error"}`;
			result.warnings?.push(errorMsg);
			await ctx.log("warn", errorMsg, error);
		}
	}
}

/**
 * Store a comment as a reply
 */
async function storeComment(
	ctx: LinearImportContext,
	parentMessageId: string,
	comment: LinearIssueComment,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"linear",
		ctx.workspaceId,
		comment.id,
		"message"
	);

	await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedMessage,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			channelId: "" as any,
			externalId: comment.id,
			idempotencyKey,
			body: comment.body,
			timestamp: new Date(comment.createdAt).getTime(),
			parentMessageId: parentMessageId as any,
			metadata: { userId: comment.userId },
		}
	);

	result.messagesCreated++;
}
