/**
 * Linear Import Provider
 *
 * Implements import pipeline for Linear following the same architecture as Slack import.
 * Handles teams, projects, issues, and comments import.
 */

import { internal } from "./_generated/api";
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
	email?: string;
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
		await ctx.log("info", "Making Linear API call", {
			query: query.substring(0, 100),
			tokenLength: ctx.accessToken?.length,
			tokenPreview: ctx.accessToken ? ctx.accessToken.substring(0, 20) + "..." : "missing",
		});

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
					await ctx.log("error", "Linear API error", {
						status: response.status,
						body: errorText.substring(0, 500),
					});
					if (response.status === 429) {
						this.rateLimiter.recordRateLimit(60);
						throw new Error(`Rate limited: ${errorText}`);
					}
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = (await response.json()) as LinearGraphQLResponse<T>;

				if (data.errors) {
					await ctx.log("error", "Linear GraphQL error", {
						errors: data.errors,
					});
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
			await ctx.log("info", "Validating Linear connection...");
			const result = await this.graphqlCall<{
				organization: { id: string; name: string };
			}>(ctx, `{ organization { id name } }`);
			await ctx.log("info", `Connected to organization: ${result.organization.name}`);
		} catch (error) {
			await ctx.log(
				"error",
				`Failed to validate Linear connection: ${error instanceof Error ? error.message : "Unknown error"}`
			);
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
		let pageCount = 0;

		do {
			pageCount++;
			await ctx.log("info", `Fetching issues page ${pageCount}...`);
			
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
			await ctx.log("info", `Fetched ${issues.length} issues on page ${pageCount} (total: ${allIssues.length})`);
			
			cursor = result.issues.pageInfo.hasNextPage
				? result.issues.pageInfo.endCursor
				: undefined;
		} while (cursor);

		await ctx.log("info", `Finished fetching issues: ${allIssues.length} total issues across ${pageCount} pages`);

		// Filter by completed status if configured
		if (!ctx.config.includeArchived) {
			const filteredIssues = allIssues.filter((issue) => !issue.completedAt);
			await ctx.log("info", `Filtered out archived/completed issues: ${allIssues.length} -> ${filteredIssues.length}`);
			return filteredIssues;
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
					states: {
						nodes: Array<{
							id: string;
							name: string;
							type: string;
							color: string;
						}>;
					};
				};
			}>(
				ctx,
				`query TeamWorkflowStates($teamId: String!) {
					team(id: $teamId) {
						states {
							nodes {
								id name type color
							}
						}
					}
				}`,
				{ teamId }
			);

			const states =
				result.team?.states?.nodes.map((state) => ({
					id: state.id,
					name: state.name,
					type: state.type as LinearState["type"],
					color: state.color,
				})) || [];

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
	userMap: Map<string, string>; // Linear user ID -> user name
	memberMap: Map<string, Id<"members">>; // Linear user ID -> member ID
	statusMap: Map<string, Id<"statuses">>; // Linear state ID -> status ID
	stateNameMap: Map<string, string>; // Linear state ID -> state name
	targetChannelId?: Id<"channels">; // Target channel to import into (if specified)
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
		memberMap: new Map(),
		statusMap: new Map(),
		stateNameMap: new Map(),
		targetChannelId: ctx.config.targetChannelId as Id<"channels"> | undefined,
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

		// Step 3: Fetch users and map to members
		await ctx.updateProgress({ currentStep: "Fetching users..." });
		const users = await provider.fetchUsers(ctx);
		result.usersMatched = users.length;
		
		// Build user and member maps
		for (const user of users) {
			linearCtx.userMap.set(user.id, user.name);

			// Try to find matching member by name first
			try {
				const memberByName = await ctx.runQuery(
					internal.importIntegrations._getMemberByName,
					{ workspaceId: ctx.workspaceId, name: user.name }
				) as any;

				if (memberByName && memberByName.member && !memberByName.conflict) {
					linearCtx.memberMap.set(user.id, memberByName.member._id);
					await ctx.log("info", `Mapped Linear user ${user.name} to member ${memberByName.member._id} (by name, ${memberByName.matchType} match)`);
				} else if (memberByName && memberByName.conflict) {
					await ctx.log("warn", `Name conflict for Linear user ${user.name}: possible matches are ${memberByName.possibleMatches?.join(", ")}. Falling back to email.`);
				}

				// If name matching failed or had conflicts, try email with auto-invite
				if ((!memberByName || memberByName.conflict) && user.email) {
					// Filter out null avatar URLs
					const cleanAvatarUrl = user.avatarUrl && user.avatarUrl !== null && user.avatarUrl !== 'null' 
						? user.avatarUrl 
						: undefined;
					
					const memberResult = await ctx.runMutation(
						internal.importIntegrations._getOrCreateMemberByEmail,
						{
							workspaceId: ctx.workspaceId,
							email: user.email,
							name: user.name,
							avatarUrl: cleanAvatarUrl,
							importSource: "Linear Import",
							importJobUserId: (ctx as any).userId
						}
					) as any;

					if (memberResult && memberResult.member) {
						linearCtx.memberMap.set(user.id, memberResult.member._id);
						if (memberResult.created) {
							await ctx.log("info", `Auto-invited Linear user ${user.name} (${user.email}) as member ${memberResult.member._id} with role ${memberResult.role}`);
						} else {
							await ctx.log("info", `Found existing member for Linear user ${user.name}: ${memberResult.member._id}`);
						}
					} else if (memberResult && memberResult.reason) {
						await ctx.log("warn", `Failed to auto-invite Linear user ${user.name}: ${memberResult.reason}`);
					}
				}
			} catch (error) {
				await ctx.log("warn", `Failed to find/create member for Linear user ${user.name}: ${error instanceof Error ? error.message : "Unknown error"}`);
			}
		}
		await ctx.log("info", `Fetched ${users.length} users, matched ${linearCtx.memberMap.size} to members`);

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
				await ctx.log("info", `Processing team ${team.name} (${team.id})`);
				const channelId = await storeTeam(linearCtx, team);
				linearCtx.teamMap.set(team.id, channelId);
				result.itemsCreated.push(channelId);
				await ctx.log("info", `Team ${team.name} -> Channel ${channelId} (total channels: ${result.itemsCreated.length})`);

				// Fetch and cache workflow states for this team
				const states = await provider.fetchWorkflowStates(ctx, team.id);
				await ctx.log(
					"info",
					`Fetched ${states.length} states for team ${team.name}`
				);

				// Map Linear states to channel statuses and cache state names
				for (const state of states) {
					const statusId = await getOrCreateStatusForState(
						linearCtx,
						channelId as Id<"channels">,
						state.id,
						state.name
					);
					// Cache the state name for later lookup during issue processing
					linearCtx.stateNameMap.set(state.id, state.name);
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
		await ctx.log("info", `Team map contents: ${Array.from(linearCtx.teamMap.entries()).map(([k, v]) => `${k}→${v}`).join(", ") || "EMPTY"}`);
		await ctx.log("info", `Channels created during import: ${result.itemsCreated.length}`);
		
		if (linearCtx.teamMap.size === 0) {
			const errorMsg = `No teams/channels were created! Import will fail to assign issues.`;
			result.warnings?.push(errorMsg);
			await ctx.log("warn", errorMsg);
		}

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

			const processedInBatch = result.messagesCreated;
			await ctx.updateProgress({
				subItemsImported: processedInBatch,
				currentStep: `Processed ${processedInBatch}/${issues.length} issues`,
			});
			
			await ctx.log("info", `Processed batch: ${processedInBatch}/${issues.length} issues total`);
		}

		// Step 8: Final summary
		const duration = Date.now() - startTime;
		const issuesCreated = result.messagesCreated;
		const issuesSkipped = issues.length - issuesCreated;
		
		await ctx.updateProgress({
			currentStep: `Import completed in ${formatDuration(duration)}`,
		});

		await ctx.log("info", "Linear import completed", {
			duration: formatDuration(duration),
			teams: result.itemsCreated.length,
			issuesCreated,
			issuesSkipped,
			issuesTotal: issues.length,
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
 * If a target channel is specified, uses that channel instead of creating new ones
 */
async function storeTeam(
	ctx: LinearImportContext,
	team: LinearTeam
): Promise<string> {
	// If target channel is specified, use it for all teams
	if (ctx.targetChannelId) {
		ctx.teamMap.set(team.id, ctx.targetChannelId);
		await ctx.log("info", `Using target channel ${ctx.targetChannelId} for team ${team.name}`);
		return ctx.targetChannelId;
	}

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
		await ctx.log("info", `Found existing channel for team ${team.name}: ${existingChannel._id}`);
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

	await ctx.log("info", `Creating new channel for team ${team.name}`);
	const channelId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedChannel,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			externalId: team.id,
			idempotencyKey,
			name: team.name,
			type: "team",
			platform: "linear" as const,
			metadata: { key: team.key },
		}
	);

	ctx.teamMap.set(team.id, channelId);
	await ctx.log("info", `Created channel ${channelId} for team ${team.name}`);
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
	// Use internal query to avoid authentication requirements during import
	const statusesResult = await ctx.runQuery(
		internal.importIntegrations.getStatusesByChannelId,
		{ channelId }
	);
	const statuses = statusesResult as Array<{
		_id: Id<"statuses">;
		name: string;
		color: string;
		order: number;
		channelId: Id<"channels">;
	}>;

	if (statuses.length === 0) {
		// No statuses exist for this channel, create a default one
		const statusId = await ctx.runMutation(
			internal.importIntegrations.createDefaultStatus,
			{
				channelId,
				name: "Todo",
				color: "#5e6ad2",
			}
		) as Id<"statuses">;
		ctx.statusMap.set(stateId, statusId);
		return statusId;
	}

	const normalizedStateName = stateName.toLowerCase().trim();

	// Try to find matching status with exact or fuzzy match
	let status = statuses.find((s) => {
		const normalizedName = s.name.toLowerCase().trim();
		// Exact match
		if (normalizedName === normalizedStateName) return true;
		
		// Fuzzy match for common state types
		const todoMatch = normalizedName.includes("todo") || normalizedName.includes("to do") || normalizedName === "tbd";
		const inProgressMatch = normalizedName.includes("progress") || normalizedName.includes("in progress") || normalizedName === "in_review";
		const doneMatch = normalizedName.includes("done") || normalizedName.includes("complete") || normalizedName === "done";
		const backlogMatch = normalizedName.includes("backlog") || normalizedName.includes("triage");
		
		if (normalizedStateName.includes("todo") && todoMatch) return true;
		if (normalizedStateName.includes("progress") && inProgressMatch) return true;
		if (normalizedStateName.includes("done") && doneMatch) return true;
		if (normalizedStateName.includes("backlog") && backlogMatch) return true;
		if (normalizedStateName.includes("triage") && backlogMatch) return true;
		
		return false;
	});

	// If no matching status found, use the first status (lowest order) as default
	if (!status) {
		// Sort by order to get the first/default status
		const sortedStatuses = [...statuses].sort((a, b) => a.order - b.order);
		status = sortedStatuses[0];
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
		await ctx.log("info", `Skipped existing issue ${issue.identifier} (already imported)`);
		return;
	}

	// Get channel ID from team map
	const channelId = ctx.teamMap.get(issue.teamId);
	if (!channelId) {
		const warning = `Team not found for issue ${issue.identifier}: teamId=${issue.teamId}`;
		result.warnings?.push(warning);
		await ctx.log("warn", `${warning}. Available teams: ${Array.from(ctx.teamMap.entries()).map(([k, v]) => `${k}→${v}`).join(", ")}`);
		return;
	}

	// Get or create status for this issue's state
	// Use cached state name if available, otherwise use the state ID as fallback
	const cachedStateName = ctx.stateNameMap.get(issue.stateId);
	const statusId = await getOrCreateStatusForState(
		ctx,
		channelId as Id<"channels">,
		issue.stateId,
		cachedStateName || "Todo"
	);

	// Map Linear priority to our system
	const priority = mapLinearPriority(issue.priority);

	// Find member for assignee using the memberMap
	let assignees: Id<"members">[] | undefined;
	if (issue.assigneeId) {
		const memberId = ctx.memberMap.get(issue.assigneeId);
		if (memberId) {
			assignees = [memberId];
			await ctx.log("info", `Assigned issue ${issue.identifier} to member ${memberId}`);
		} else {
			const warning = `Could not find member for Linear user ID: ${issue.assigneeId} (issue: ${issue.identifier})`;
			result.warnings?.push(warning);
			await ctx.log("warn", warning);
		}
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
	
	await ctx.log("info", `Imported issue ${issue.identifier} with ${assignees?.length || 0} assignees`);
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
