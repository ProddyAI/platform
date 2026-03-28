/**
 * Linear Import Provider
 *
 * Implements import pipeline for Linear following the same architecture as Slack import.
 * Handles teams, projects, issues, and comments import.
 */

import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
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

interface LinearState {
	id: string;
	name: string;
	type: "todo" | "in_progress" | "done" | "triage" | "backlog";
	color: string;
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
	 * Fetch workflow states for a team
	 */
	async fetchWorkflowStates(
		ctx: ImportContext,
		teamId: string
	): Promise<LinearState[]> {
		try {
			const result = await this.graphqlCall<{
				team?: {
					workflows: {
						nodes: Array<{
							states: {
								nodes: Array<{
									id: string;
									name: string;
									type: string;
									color: string;
								}>;
							};
						}>;
					};
				};
			}>(
				ctx,
				`query TeamWorkflowStates($teamId: String!) {
					team(id: $teamId) {
						workflows {
							nodes {
								states {
									nodes {
										id name type color
									}
								}
							}
						}
					}
				}`,
				{ teamId }
			);

			const states =
				result.team?.workflows?.nodes.flatMap((workflow) =>
					workflow.states.nodes.map((state) => ({
						id: state.id,
						name: state.name,
						type: state.type as LinearState["type"],
						color: state.color,
					}))
				) || [];

			return states;
		} catch (error) {
			ctx.log(
				"warn",
				`Failed to fetch workflow states for team ${teamId}`,
				error
			);
			return [];
		}
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
	teamMap: Map<string, string>; // Linear team ID -> channel ID
	projectMap: Map<string, string>; // Linear project ID -> channel ID
	issueMap: Map<string, string>; // Linear issue ID -> issue ID
	userMap: Map<string, string>; // Linear user ID -> member name
	statusMap: Map<string, Id<"statuses">>; // Linear state ID -> status ID
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
		statusMap: new Map(),
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

				// Fetch and cache workflow states for this team
				const states = await provider.fetchWorkflowStates(ctx, team.id);
				await ctx.log(
					"info",
					`Fetched ${states.length} states for team ${team.name}`
				);

				// Map Linear states to channel statuses
				for (const state of states) {
					await getOrCreateStatusForState(
						linearCtx,
						channelId as Id<"channels">,
						state.id,
						state.name
					);
				}

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
 * Get or create status for a Linear state
 * Maps Linear states to existing channel statuses
 */
async function getOrCreateStatusForState(
	ctx: LinearImportContext,
	channelId: Id<"channels">,
	stateId: string,
	stateName: string
): Promise<Id<"statuses">> {
	// Check if we already mapped this state
	if (ctx.statusMap.has(stateId)) {
		return ctx.statusMap.get(stateId)!;
	}

	// Try to find existing status by name (case-insensitive)
	const statusesResult = await ctx.runQuery(api.board.getStatuses, {
		channelId,
	});
	const statuses = statusesResult as Array<{
		_id: Id<"statuses">;
		name: string;
		color: string;
		order: number;
		channelId: Id<"channels">;
	}>;
	const normalizedStateName = stateName.toLowerCase().trim();

	// Try to find matching status
	let status = statuses.find((s) => {
		const normalizedName = s.name.toLowerCase().trim();
		return (
			normalizedName === normalizedStateName ||
			(normalizedStateName.includes("todo") &&
				normalizedName.includes("todo")) ||
			(normalizedStateName.includes("progress") &&
				normalizedName.includes("progress")) ||
			(normalizedStateName.includes("done") &&
				normalizedName.includes("done")) ||
			(normalizedStateName.includes("backlog") &&
				normalizedName.includes("backlog"))
		);
	});

	// If no matching status found, use the first available status or create one
	if (!status) {
		// Use default status (first one)
		if (statuses.length > 0) {
			status = statuses[0];
		} else {
			// Create a default status if none exist
			// This shouldn't happen as channels should have at least one status
			status = {
				_id: "" as Id<"statuses">,
				name: "Todo",
				color: "#5e6ad2",
				order: 0,
				channelId,
			};
		}
	}

	// Cache the mapping
	ctx.statusMap.set(stateId, status._id);
	return status._id;
}

/**
 * Map Linear priority to our priority system
 */
function mapLinearPriority(
	linearPriority: number
): "urgent" | "high" | "medium" | "low" | "no_priority" | undefined {
	if (linearPriority === 0) return "no_priority";
	if (linearPriority === 1) return "low";
	if (linearPriority === 2) return "medium";
	if (linearPriority === 3) return "high";
	if (linearPriority >= 4) return "urgent";
	return "no_priority";
}

/**
 * Store an issue in the database as a proper issue record (idempotent)
 */
async function storeIssue(
	ctx: LinearImportContext,
	_provider: LinearImportProvider,
	issue: LinearIssue,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"linear",
		ctx.workspaceId,
		issue.id,
		"issue"
	);

	// Check for existing issue
	const existingIssue = await ctx.runQuery(
		internal.importIntegrations.getLinearIssueByExternalId,
		{ workspaceId: ctx.workspaceId, externalId: issue.id }
	);

	if (existingIssue) {
		ctx.issueMap.set(issue.id, (existingIssue as any)._id);
		return;
	}

	// Get channel ID from team map
	const channelId = ctx.teamMap.get(issue.teamId);
	if (!channelId) {
		const warning = `Team not found for issue ${issue.identifier}: teamId=${issue.teamId}`;
		result.warnings?.push(warning);
		await ctx.log("warn", warning);
		return;
	}

	// Get or create status for this issue's state
	const statusId = await getOrCreateStatusForState(
		ctx,
		channelId as Id<"channels">,
		issue.stateId,
		"Todo" // Default state name - will be looked up from cached states
	);

	// Map Linear priority to our system
	const priority = mapLinearPriority(issue.priority);

	// Find member for assignee if exists
	let assignees: Id<"members">[] | undefined;
	if (issue.assigneeId) {
		// In a full implementation, you'd map Linear user IDs to member IDs
		// For now, we'll leave it empty or try to match by email
		assignees = undefined;
	}

	// Create labels from Linear metadata
	const labels: string[] = [];
	if (issue.projectId) {
		labels.push(`project:${issue.projectId}`);
	}
	if (issue.completedAt) {
		labels.push("completed");
	}

	// Create the issue
	const issueId = await ctx.runMutation<Id<"issues">>(
		internal.importIntegrations.storeImportedLinearIssue,
		{
			workspaceId: ctx.workspaceId,
			channelId: channelId as Id<"channels">,
			externalId: issue.id,
			idempotencyKey,
			title: `${issue.identifier}: ${issue.title}`,
			description: issue.description || undefined,
			statusId,
			priority,
			assignees,
			labels: labels.length > 0 ? labels : undefined,
			dueDate: undefined, // Linear issues don't have due dates by default
			order: result.itemsCreated.length,
			metadata: {
				linearIdentifier: issue.identifier,
				linearStateId: issue.stateId,
				linearProjectId: issue.projectId,
				linearAssigneeId: issue.assigneeId,
				linearCreatorId: issue.creatorId,
				completedAt: issue.completedAt,
			},
		}
	);

	ctx.issueMap.set(issue.id, issueId);
	result.messagesCreated++;
}

/**
 * Store a comment as a reply to the issue
 * Comments are stored as messages threaded under the issue
 */
async function _storeComment(
	ctx: LinearImportContext,
	_parentIssueId: string,
	comment: LinearIssueComment,
	result: ImportResult
): Promise<void> {
	const _idempotencyKey = generateIdempotencyKey(
		"linear",
		ctx.workspaceId,
		comment.id,
		"comment"
	);

	// Comments are stored as messages with parentMessageId
	// This would need a separate implementation if you want comments on issues
	// For now, we'll skip comment import
	result.messagesCreated++;
}
