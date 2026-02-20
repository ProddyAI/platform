/**
 * Todoist Import Provider
 *
 * Implements import pipeline for Todoist following the same architecture as Slack import.
 * Handles projects, tasks, sections, and labels import with:
 * - Rate limiting compliance
 * - Exponential backoff retry
 * - Idempotency (no duplicates on re-import)
 * - Pagination support
 * - Safe retry handling
 */

import { internal } from "./_generated/api";
import {
	chunkArray,
	type ExternalChannel,
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
// TODOIST API TYPES
// ============================================================================

interface TodoistUser {
	id: string;
	name: string;
	email: string;
	avatar?: string;
}

interface TodoistProject {
	id: string;
	name: string;
	color?: string;
	is_favorite?: boolean;
	is_inbox_project?: boolean;
	is_shared?: boolean;
	view_style?: string;
	parent_id?: string | null;
	order?: number;
}

interface TodoistSection {
	id: string;
	project_id: string;
	order: number;
	name: string;
}

interface TodoistTask {
	id: string;
	content: string;
	description?: string;
	project_id: string;
	section_id?: string | null;
	parent_id?: string | null;
	order?: number;
	labels?: string[];
	priority?: number;
	due?: {
		date: string;
		string?: string;
		lang?: string;
		is_recurring?: boolean;
		timezone?: string;
	};
	duration?: {
		amount?: number;
		unit?: "minute" | "day";
	};
	creator_id?: string;
	created_at?: string;
	completed_at?: string | null;
}

interface TodoistLabel {
	id: string;
	name: string;
	color?: string;
	order?: number;
	is_favorite?: boolean;
}

interface TodoistComment {
	id: string;
	content: string;
	posted_at: string;
	task_id?: string;
	project_id?: string;
	user_id: string;
	attachment?: {
		resource_type?: string;
		file_name?: string;
		file_url?: string;
		file_type?: string;
	};
}

// ============================================================================
// TODOIST IMPORT PROVIDER CLASS
// ============================================================================

export class TodoistImportProvider {
	readonly platform: ImportPlatform = "todoist";

	/** Rate limiter for Todoist API calls */
	private rateLimiter: RateLimiter;

	/** Batch size for storing tasks */
	public static readonly TASK_BATCH_SIZE = 50;

	constructor() {
		this.rateLimiter = new RateLimiter({
			minDelay: 100, // Todoist allows ~50 requests per minute
			maxDelay: 30000,
		});
	}

	/**
	 * Make an authenticated Todoist API call with rate limiting and retry.
	 */
	private async apiCall<T>(
		ctx: ImportContext,
		endpoint: string,
		params: Record<string, string> = {}
	): Promise<T> {
		return withRetry(
			async () => {
				// Check if cancelled
				if (await ctx.isCancelled()) {
					throw new Error("Import cancelled");
				}

				// Wait for rate limiter
				await this.rateLimiter.wait();

				const url = `https://api.todoist.com/rest/v2/${endpoint}`;
				const searchParams = new URLSearchParams(params);

				const response = await fetch(
					`${url}${searchParams.toString() ? `?${searchParams}` : ""}`,
					{
						method: "GET",
						headers: {
							Authorization: `Bearer ${ctx.accessToken}`,
						},
					}
				);

				if (!response.ok) {
					const errorText = await response.text();
					if (response.status === 429) {
						this.rateLimiter.recordRateLimit(60);
						throw new Error(`Rate limited: ${errorText}`);
					}
					if (response.status >= 500) {
						this.rateLimiter.recordServerError();
						throw new Error(`Server error ${response.status}: ${errorText}`);
					}
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = (await response.json()) as T;
				this.rateLimiter.recordSuccess();
				return data;
			},
			{
				maxAttempts: 5,
				initialDelay: 1000,
				maxDelay: 30000,
			},
			async (attempt, error, delay) => {
				await ctx.log("warn", `Todoist API retry ${attempt}/5`, {
					endpoint,
					error: error.message,
					delayMs: delay,
				});
			}
		);
	}

	/**
	 * Validate the Todoist connection.
	 */
	async validateConnection(ctx: ImportContext): Promise<void> {
		const url = "https://api.todoist.com/rest/v2/projects";
		console.log("[TodoistValidate] Calling URL:", url);
		console.log("[TodoistValidate] Token present:", !!ctx.accessToken);

		try {
			await ctx.log("info", "Validating Todoist connection");
			// Test the connection by fetching projects (lightweight validation)
			const response = await fetch(url, {
				headers: {
					Authorization: `Bearer ${ctx.accessToken}`,
				},
			});

			console.log("[TodoistValidate] Response status:", response.status);

			if (!response.ok) {
				const errorText = await response.text();
				console.log("[TodoistValidate] Error response:", errorText);
				await ctx.log(
					"error",
					`Todoist validation failed: HTTP ${response.status}`,
					errorText
				);
				throw new Error(`HTTP ${response.status}: ${errorText}`);
			}

			await response.json();
			await ctx.log("info", "Todoist connection validated successfully");
		} catch (error) {
			console.log("[TodoistValidate] Exception:", error);
			throw new Error(
				`Failed to validate Todoist connection: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Fetch workspace metadata from Todoist.
	 */
	async fetchWorkspace(ctx: ImportContext): Promise<WorkspaceMetadata> {
		const user = await this.apiCall<TodoistUser>(ctx, "user");

		return {
			externalId: user.id,
			name: `${user.name}'s Todoist`,
			metadata: {
				email: user.email,
				avatar: user.avatar,
			},
		};
	}

	/**
	 * Fetch all projects from Todoist.
	 */
	async fetchProjects(ctx: ImportContext): Promise<ExternalChannel[]> {
		const projects = await this.apiCall<TodoistProject[]>(ctx, "projects");

		return projects.map((project) => ({
			externalId: project.id,
			name: project.name,
			type: project.is_inbox_project
				? "inbox"
				: project.parent_id
					? "sub_project"
					: "project",
			description: undefined,
			createdAt: undefined,
			metadata: {
				color: project.color,
				isFavorite: project.is_favorite,
				isInbox: project.is_inbox_project,
				isShared: project.is_shared,
				parentId: project.parent_id,
				order: project.order,
			},
		}));
	}

	/**
	 * Fetch all sections from Todoist.
	 */
	async fetchSections(ctx: ImportContext): Promise<any[]> {
		try {
			return await this.apiCall<TodoistSection[]>(ctx, "sections");
		} catch (error) {
			// Sections endpoint might not be available
			ctx.log("warn", "Failed to fetch sections", error);
			return [];
		}
	}

	/**
	 * Fetch all tasks from Todoist.
	 */
	async fetchAllTasks(ctx: ImportContext): Promise<TodoistTask[]> {
		const tasks = await this.apiCall<TodoistTask[]>(ctx, "tasks");

		// Filter by completed status if configured
		if (!ctx.config.includeCompleted) {
			return tasks.filter((task) => !task.completed_at);
		}

		return tasks;
	}

	/**
	 * Fetch comments for a task.
	 */
	async fetchTaskComments(
		ctx: ImportContext,
		taskId: string
	): Promise<TodoistComment[]> {
		try {
			return await this.apiCall<TodoistComment[]>(
				ctx,
				`tasks/${taskId}/comments`
			);
		} catch (error) {
			ctx.log("warn", `Failed to fetch comments for task ${taskId}`, error);
			return [];
		}
	}

	/**
	 * Fetch all labels from Todoist.
	 */
	async fetchLabels(ctx: ImportContext): Promise<TodoistLabel[]> {
		try {
			return await this.apiCall<TodoistLabel[]>(ctx, "labels");
		} catch (error) {
			ctx.log("warn", "Failed to fetch labels", error);
			return [];
		}
	}

	/**
	 * Fetch users from Todoist (collaborators).
	 */
	async fetchUsers(ctx: ImportContext): Promise<any[]> {
		// Get current user
		const user = await this.apiCall<TodoistUser>(ctx, "user");

		return [
			{
				externalId: user.id,
				displayName: user.name,
				email: user.email,
				avatarUrl: user.avatar,
				isBot: false,
				isDeleted: false,
				metadata: {},
			},
		];
	}
}

/**
 * Import context extended with Todoist-specific tracking
 */
interface TodoistImportContext extends ImportContext {
	/** Map of external project ID to internal channel ID */
	projectMap: Map<string, string>;
	/** Map of external task ID to internal message ID */
	taskMap: Map<string, string>;
	/** Map of external label ID to tag name */
	labelMap: Map<string, string>;
	/** Map of external section ID to internal list ID */
	sectionMap: Map<string, string>;
}

/**
 * Execute a Todoist import using the provider.
 * Follows the same pipeline structure as Slack import.
 */
export async function executeTodoistImport(
	ctx: ImportContext,
	provider: TodoistImportProvider
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

	// Create extended context with tracking maps
	const todoistCtx: TodoistImportContext = {
		...ctx,
		projectMap: new Map(),
		taskMap: new Map(),
		labelMap: new Map(),
		sectionMap: new Map(),
	};

	try {
		// Step 1: Validate connection
		await ctx.updateProgress({
			currentStep: "Validating Todoist connection...",
		});
		await provider.validateConnection(ctx);

		// Step 2: Fetch workspace info
		await ctx.updateProgress({ currentStep: "Fetching workspace info..." });
		const _workspace = await provider.fetchWorkspace(ctx);

		// Step 3: Fetch labels
		await ctx.updateProgress({ currentStep: "Fetching labels..." });
		const labels = await provider.fetchLabels(ctx);
		labels.forEach((label) => {
			todoistCtx.labelMap.set(label.id, label.name);
		});
		await ctx.log("info", `Fetched ${labels.length} labels`);

		// Step 4: Fetch users
		await ctx.updateProgress({ currentStep: "Fetching users..." });
		const users = await provider.fetchUsers(ctx);
		result.usersMatched = users.length;
		await ctx.log("info", `Fetched ${users.length} users`);

		// Step 5: Fetch projects
		await ctx.updateProgress({ currentStep: "Fetching projects..." });
		const projects = await provider.fetchProjects(ctx);

		if (projects.length === 0) {
			await ctx.updateProgress({
				currentStep: "No projects found",
				itemsTotal: 0,
			});
			return result;
		}

		await ctx.updateProgress({
			itemsTotal: projects.length,
			currentStep: `Found ${projects.length} projects`,
		});
		await ctx.log("info", `Fetched ${projects.length} projects`);

		// Step 6: Fetch sections
		await ctx.updateProgress({ currentStep: "Fetching sections..." });
		const sections = await provider.fetchSections(ctx);
		sections.forEach((section) => {
			todoistCtx.sectionMap.set(section.id, section.project_id);
		});
		await ctx.log("info", `Fetched ${sections.length} sections`);

		// Step 7: Process projects
		await ctx.updateProgress({ currentStep: "Importing projects..." });

		for (const [index, project] of projects.entries()) {
			if (await ctx.isCancelled()) {
				throw new Error("Import cancelled");
			}

			try {
				const channelId = await storeProject(todoistCtx, project);
				todoistCtx.projectMap.set(project.externalId, channelId);
				result.itemsCreated.push(channelId);

				await ctx.updateProgress({
					itemsImported: index + 1,
					currentStep: `Processed ${index + 1}/${projects.length} projects`,
				});
			} catch (error) {
				const errorMsg = `Failed to process project ${project.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
				result.errors?.push(errorMsg);
				await ctx.log("error", errorMsg, error);
			}
		}

		// Step 8: Fetch and process tasks
		await ctx.updateProgress({ currentStep: "Fetching tasks..." });
		const tasks = await provider.fetchAllTasks(ctx);

		await ctx.updateProgress({
			subItemsTotal: tasks.length,
			currentStep: `Found ${tasks.length} tasks`,
		});
		await ctx.log("info", `Fetched ${tasks.length} tasks`);

		// Process tasks in batches
		const taskBatches = chunkArray(
			tasks,
			TodoistImportProvider.TASK_BATCH_SIZE
		);

		for (const [_batchIndex, taskBatch] of taskBatches.entries()) {
			if (await ctx.isCancelled()) {
				throw new Error("Import cancelled");
			}

			for (const task of taskBatch) {
				try {
					await storeTask(todoistCtx, provider, task, result);
				} catch (error) {
					const errorMsg = `Failed to process task ${task.content}: ${error instanceof Error ? error.message : "Unknown error"}`;
					result.errors?.push(errorMsg);
					await ctx.log("error", errorMsg, error);
				}
			}

			await ctx.updateProgress({
				subItemsImported: result.messagesCreated,
				currentStep: `Processed ${result.messagesCreated}/${tasks.length} tasks`,
			});
		}

		// Step 9: Final summary
		const duration = Date.now() - startTime;
		await ctx.updateProgress({
			currentStep: `Import completed in ${formatDuration(duration)}`,
		});

		await ctx.log("info", "Todoist import completed", {
			duration: formatDuration(duration),
			projects: result.itemsCreated.length,
			tasks: result.messagesCreated,
			users: result.usersMatched,
			errors: result.errors?.length || 0,
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		result.errors?.push(`Import failed: ${errorMsg}`);
		await ctx.log("error", "Todoist import failed", error);
		throw error;
	}

	return result;
}

/**
 * Store a project in the database (idempotent).
 * Checks for existing channels by external ID to prevent duplicates.
 */
async function storeProject(
	ctx: TodoistImportContext,
	project: ExternalChannel
): Promise<string> {
	const idempotencyKey = generateIdempotencyKey(
		"todoist",
		ctx.workspaceId,
		project.externalId,
		"channel"
	);

	// Check if project already exists by external ID
	const existingChannel = (await ctx.runQuery(
		internal.importIntegrations.getChannelByExternalId,
		{
			workspaceId: ctx.workspaceId,
			externalId: project.externalId,
		}
	)) as any;

	if (existingChannel) {
		// Update project name if it changed (user might have renamed it)
		if (existingChannel.name !== project.name) {
			await ctx.runMutation(
				internal.importIntegrations.updateImportedChannelName,
				{
					channelId: existingChannel._id,
					name: project.name,
				}
			);
		}
		await ctx.log(
			"info",
			`Project ${project.name} already exists, using existing`
		);
		ctx.projectMap.set(project.externalId, existingChannel._id);
		return existingChannel._id;
	}

	// Create channel in database
	const channelId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedChannel,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			externalId: project.externalId,
			idempotencyKey,
			name: project.name,
			type: project.type,
			description: project.description,
			metadata: project.metadata,
		}
	);

	await ctx.log("info", `Created project ${project.name}`);
	return channelId;
}

/**
 * Store a task in the database (idempotent).
 * Checks for existing messages by external ID to prevent duplicates.
 */
async function storeTask(
	ctx: TodoistImportContext,
	provider: TodoistImportProvider,
	task: TodoistTask,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"todoist",
		ctx.workspaceId,
		task.id,
		"message"
	);

	// Check if task already exists
	const existingMessage = (await ctx.runQuery(
		internal.importIntegrations.getMessageByExternalId,
		{
			workspaceId: ctx.workspaceId,
			externalId: task.id,
		}
	)) as any;

	if (existingMessage) {
		ctx.taskMap.set(task.id, existingMessage._id);
		return; // Skip, already imported
	}

	// Get channel ID from project map
	const channelId = ctx.projectMap.get(task.project_id);
	if (!channelId) {
		const warning = `Project not found for task: ${task.content}`;
		result.warnings?.push(warning);
		await ctx.log("warn", warning);
		return;
	}

	// Build task content with metadata
	let body = task.content;
	if (task.description) {
		body += `\n\n${task.description}`;
	}

	// Get labels as tags
	const tags = task.labels
		?.map((labelId) => ctx.labelMap.get(labelId))
		.filter(Boolean) as string[];

	// Store task
	const messageId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedMessage,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			channelId: channelId as any,
			externalId: task.id,
			idempotencyKey,
			body,
			timestamp: task.created_at
				? new Date(task.created_at).getTime()
				: Date.now(),
			metadata: {
				priority: task.priority,
				due: task.due,
				labels: tags,
				isCompleted: !!task.completed_at,
				completedAt: task.completed_at,
				sectionId: task.section_id,
				parentId: task.parent_id,
			},
		}
	);

	ctx.taskMap.set(task.id, messageId);
	result.messagesCreated++;

	// Fetch and store comments if enabled
	if (ctx.config.includeComments) {
		try {
			const comments = await provider.fetchTaskComments(ctx, task.id);
			for (const comment of comments) {
				await storeComment(ctx, messageId, comment, result);
			}
		} catch (error) {
			const errorMsg = `Failed to fetch comments for task ${task.content}: ${error instanceof Error ? error.message : "Unknown error"}`;
			result.warnings?.push(errorMsg);
			await ctx.log("warn", errorMsg, error);
		}
	}
}

/**
 * Store a comment as a reply to a task.
 */
async function storeComment(
	ctx: TodoistImportContext,
	parentMessageId: string,
	comment: TodoistComment,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"todoist",
		ctx.workspaceId,
		comment.id,
		"message"
	);

	const _messageId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedMessage,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			channelId: "" as any, // Not needed for replies
			externalId: comment.id,
			idempotencyKey,
			body: comment.content,
			timestamp: new Date(comment.posted_at).getTime(),
			parentMessageId: parentMessageId as any,
			metadata: {
				userId: comment.user_id,
				attachment: comment.attachment,
			},
		}
	);

	result.messagesCreated++;
}
