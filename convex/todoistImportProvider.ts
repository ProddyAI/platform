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
import type { Id } from "./_generated/dataModel";
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
	name?: string;
	full_name?: string;
	email: string;
	avatar?: string;
	avatar_big?: string;
	avatar_medium?: string;
	avatar_small?: string;
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

				const url = `https://api.todoist.com/api/v1/${endpoint}`;
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
	 * Make a paginated Todoist API v1 call, following `next_cursor` until
	 * exhausted, and return the flattened list of `results`.
	 *
	 * The v1 API wraps list responses in `{ results, next_cursor }` (unlike the
	 * deprecated REST v2 API, which returned bare arrays).
	 */
	private async apiCallPaginated<T>(
		ctx: ImportContext,
		endpoint: string,
		params: Record<string, string> = {}
	): Promise<T[]> {
		const all: T[] = [];
		let cursor: string | undefined;

		do {
			const page = await this.apiCall<
				{ results?: T[]; next_cursor?: string | null } | T[]
			>(ctx, endpoint, {
				...params,
				limit: "200",
				...(cursor ? { cursor } : {}),
			});

			// Defensive: tolerate a bare array in case an endpoint isn't paginated.
			if (Array.isArray(page)) {
				all.push(...page);
				break;
			}

			all.push(...(page.results ?? []));
			cursor = page.next_cursor ?? undefined;
		} while (cursor);

		return all;
	}

	/**
	 * Validate the Todoist connection.
	 */
	async validateConnection(ctx: ImportContext): Promise<void> {
		const url = "https://api.todoist.com/api/v1/projects";
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
		const displayName = user.full_name || user.name || "Todoist User";
		const avatarUrl =
			user.avatar_big || user.avatar_medium || user.avatar_small || user.avatar;

		return {
			externalId: user.id,
			name: `${displayName}'s Todoist`,
			metadata: {
				email: user.email,
				avatar: avatarUrl,
			},
		};
	}

	/**
	 * Fetch all projects from Todoist.
	 */
	async fetchProjects(ctx: ImportContext): Promise<ExternalChannel[]> {
		const projects = await this.apiCallPaginated<TodoistProject>(
			ctx,
			"projects"
		);

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
			return await this.apiCallPaginated<TodoistSection>(ctx, "sections");
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
		const tasks = await this.apiCallPaginated<TodoistTask>(ctx, "tasks");

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
			return await this.apiCallPaginated<TodoistComment>(ctx, "comments", {
				task_id: taskId,
			});
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
			return await this.apiCallPaginated<TodoistLabel>(ctx, "labels");
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
		const displayName = user.full_name || user.name || "Todoist User";
		const avatarUrl =
			user.avatar_big || user.avatar_medium || user.avatar_small || user.avatar;

		return [
			{
				externalId: user.id,
				displayName,
				email: user.email,
				avatarUrl,
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
		tasksCreated: 0,
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
				const categoryId = await storeProjectAsCategory(todoistCtx, project);
				todoistCtx.projectMap.set(project.externalId, categoryId);
				// Categories are not channels — leave result.itemsCreated empty so the
				// job's channelsCreated (typed v.id("channels")[]) stays valid.

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
				subItemsImported: result.tasksCreated ?? 0,
				currentStep: `Processed ${result.tasksCreated ?? 0}/${tasks.length} tasks`,
			});
		}

		// Step 9: Final summary
		const duration = Date.now() - startTime;
		await ctx.updateProgress({
			currentStep: `Import completed in ${formatDuration(duration)}`,
		});

		await ctx.log("info", "Todoist import completed", {
			duration: formatDuration(duration),
			projects: todoistCtx.projectMap.size,
			tasks: result.tasksCreated ?? 0,
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

// ============================================================================
// STORAGE HELPERS
// ============================================================================

const DEFAULT_CATEGORY_COLOR = "#808080";

/** Map Todoist project color names to hex for Tasks-feature categories. */
const TODOIST_COLOR_HEX: Record<string, string> = {
	berry_red: "#b8256f",
	red: "#db4035",
	orange: "#ff9933",
	yellow: "#fad000",
	olive_green: "#afb83b",
	lime_green: "#7ecc49",
	green: "#299438",
	mint_green: "#6accbc",
	teal: "#158fad",
	sky_blue: "#14aaf5",
	light_blue: "#96c3eb",
	blue: "#4073ff",
	grape: "#884dff",
	violet: "#af38eb",
	lavender: "#eb96eb",
	magenta: "#e05194",
	salmon: "#ff8d85",
	charcoal: "#808080",
	grey: "#b8b8b8",
	taupe: "#ccac93",
};

/**
 * Map a Todoist priority (1 = default … 4 = urgent) to a Tasks priority.
 * Priority 1 (default) maps to no explicit priority.
 */
function mapTodoistPriority(
	priority?: number
): "low" | "medium" | "high" | undefined {
	switch (priority) {
		case 4:
			return "high";
		case 3:
			return "medium";
		case 2:
			return "low";
		default:
			return undefined;
	}
}

/**
 * Map a Todoist project to a task category (idempotent by name). Returns the
 * internal category id used to group the project's imported tasks.
 */
async function storeProjectAsCategory(
	ctx: TodoistImportContext,
	project: ExternalChannel
): Promise<string> {
	const todoistColor = (project.metadata as { color?: string } | undefined)
		?.color;
	const color =
		(todoistColor && TODOIST_COLOR_HEX[todoistColor]) || DEFAULT_CATEGORY_COLOR;

	const categoryId = await ctx.runMutation<string>(
		internal.importTasks.getOrCreateImportedCategory,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			name: project.name,
			color,
		}
	);

	ctx.projectMap.set(project.externalId, categoryId);
	await ctx.log("info", `Mapped project ${project.name} to task category`);
	return categoryId;
}

/**
 * Store a Todoist task as a Task in the Tasks feature (idempotent).
 * Tasks are grouped under the category mapped from their Todoist project.
 */
async function storeTask(
	ctx: TodoistImportContext,
	_provider: TodoistImportProvider,
	task: TodoistTask,
	result: ImportResult
): Promise<void> {
	const idempotencyKey = generateIdempotencyKey(
		"todoist",
		ctx.workspaceId,
		task.id,
		"task"
	);

	// Skip tasks that were already imported.
	const existingTaskId = await ctx.runQuery(
		internal.importTasks.getImportedTaskId,
		{ idempotencyKey }
	);
	if (existingTaskId) {
		ctx.taskMap.set(task.id, existingTaskId as string);
		return;
	}

	// Category mapped from the task's Todoist project (undefined for tasks with
	// no matching project — still imported, just uncategorised).
	const categoryId = ctx.projectMap.get(task.project_id);

	const completed = !!task.completed_at;

	const description =
		task.description && task.description.trim().length > 0
			? task.description
			: undefined;

	const dueMs = task.due?.date ? new Date(task.due.date).getTime() : undefined;
	const dueDate = dueMs !== undefined && !Number.isNaN(dueMs) ? dueMs : undefined;

	// In Todoist API v1 a task's `labels` are label names (not ids).
	const tags = (task.labels ?? []).filter(Boolean);

	const createdMs = task.created_at
		? new Date(task.created_at).getTime()
		: Date.now();

	const taskId = await ctx.runMutation<string>(
		internal.importTasks.storeImportedTask,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			platform: "todoist",
			externalId: task.id,
			idempotencyKey,
			title: task.content,
			description,
			status: completed ? "completed" : "not_started",
			completed,
			priority: mapTodoistPriority(task.priority),
			dueDate,
			categoryId: categoryId as Id<"categories"> | undefined,
			tags,
			timestamp: Number.isNaN(createdMs) ? Date.now() : createdMs,
			metadata: {
				sectionId: task.section_id,
				parentId: task.parent_id,
				todoistPriority: task.priority,
			},
		}
	);

	ctx.taskMap.set(task.id, taskId);
	result.tasksCreated = (result.tasksCreated ?? 0) + 1;
}
