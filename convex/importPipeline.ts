/**
 * Reusable Import Pipeline Architecture
 *
 * This module provides a template for implementing data imports from external platforms.
 * Each platform (Slack, Notion, Linear, etc.) implements the ImportProvider interface.
 *
 * Architecture:
 * - ImportProvider: Interface that all providers must implement
 * - RateLimiter: Handles API rate limiting with exponential backoff
 * - RetryHandler: Safe retry logic with configurable attempts
 * - IdempotencyKey: Ensures no duplicate records on re-import
 * - ImportProgress: Tracks and reports import progress
 */

import type { Id } from "./_generated/dataModel";

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Import job status
 */
export type ImportJobStatus =
	| "pending"
	| "in_progress"
	| "completed"
	| "failed"
	| "cancelled";

/**
 * Platform identifier
 */
export type ImportPlatform =
	| "slack"
	| "todoist"
	| "linear"
	| "notion"
	| "miro"
	| "clickup";

/**
 * Import configuration - common across all platforms
 */
export interface ImportConfig {
	/** Specific items to import (e.g., channel IDs) */
	items?: string[];
	/** Import data from this date (timestamp) */
	dateFrom?: number;
	/** Import data until this date (timestamp) */
	dateTo?: number;
	/** Include file attachments */
	includeFiles?: boolean;
	/** Include threaded/nested content */
	includeThreads?: boolean;
	/** Include completed tasks (Todoist-specific) */
	includeCompleted?: boolean;
	/** Include comments (Todoist/Linear-specific) */
	includeComments?: boolean;
	/** Include archived items (Linear-specific) */
	includeArchived?: boolean;
	/** Platform-specific config */
	platformConfig?: Record<string, unknown>;
}

/**
 * Import progress tracking
 */
export interface ImportProgress {
	/** Number of items imported so far */
	itemsImported: number;
	/** Total number of items to import */
	itemsTotal: number;
	/** Number of sub-items imported (e.g., messages within channels) */
	subItemsImported: number;
	/** Total number of sub-items */
	subItemsTotal?: number;
	/** Number of users matched/imported */
	usersImported: number;
	/** Number of files imported */
	filesImported: number;
	/** Current step description */
	currentStep: string;
	/** Platform-specific progress data */
	platformData?: Record<string, unknown>;
	/** For compatibility with existing import_jobs.progress */
	channelsImported?: number;
	channelsTotal?: number;
	messagesImported?: number;
	messagesTotal?: number;
}

/**
 * Import result summary
 */
export interface ImportResult {
	/** IDs of created/imported items (channels, etc.) */
	itemsCreated: string[];
	/** Number of messages/sub-items created */
	messagesCreated: number;
	/** Number of users matched */
	usersMatched: number;
	/** Number of files imported */
	filesImported: number;
	/** Errors encountered (non-fatal) */
	errors?: string[];
	/** Warnings encountered */
	warnings?: string[];
	/** Platform-specific result data */
	platformData?: Record<string, unknown>;
}

/**
 * Rate limit information
 */
export interface RateLimitInfo {
	/** Remaining requests */
	remaining: number;
	/** Reset time (timestamp) */
	resetAt: number;
	/** Retry after seconds */
	retryAfter?: number;
}

/**
 * Import context passed to provider methods
 */
export interface ImportContext {
	/** Access token for API calls */
	accessToken: string;
	/** Refresh token (if available) */
	refreshToken?: string;
	/** Token expiration timestamp */
	expiresAt?: number;
	/** Platform-specific credentials */
	credentials?: Record<string, unknown>;
	/** Import configuration */
	config: ImportConfig;
	/** Current progress */
	progress: ImportProgress;
	/** Job ID for logging */
	jobId: Id<"import_jobs">;
	/** Workspace ID */
	workspaceId: Id<"workspaces">;
	/** Member ID */
	memberId: Id<"members">;
	/** Signal to check if import was cancelled */
	isCancelled: () => Promise<boolean>;
	/** Update progress callback */
	updateProgress: (progress: Partial<ImportProgress>) => Promise<void>;
	/** Log message callback */
	log: (
		level: "info" | "warn" | "error",
		message: string,
		data?: unknown
	) => Promise<void>;
	/** Run mutation callback */
	runMutation: <T>(mutation: any, args: any) => Promise<T>;
	/** Run query callback */
	runQuery: <T>(query: any, args: any) => Promise<T>;
}

/**
 * Workspace metadata from external platform
 */
export interface WorkspaceMetadata {
	/** External platform ID */
	externalId: string;
	/** Human-readable name */
	name: string;
	/** Platform-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * User from external platform
 */
export interface ExternalUser {
	/** External platform ID */
	externalId: string;
	/** Display name */
	displayName: string;
	/** Email address */
	email?: string;
	/** Profile image URL */
	avatarUrl?: string;
	/** Is this user a bot? */
	isBot?: boolean;
	/** Is this user deleted? */
	isDeleted?: boolean;
	/** Platform-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Channel/Container from external platform
 */
export interface ExternalChannel {
	/** External platform ID */
	externalId: string;
	/** Channel name */
	name: string;
	/** Channel type (public, private, etc.) */
	type: string;
	/** Channel description/purpose */
	description?: string;
	/** Created timestamp */
	createdAt?: number;
	/** Platform-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Message from external platform
 */
export interface ExternalMessage {
	/** External platform ID */
	externalId: string;
	/** Message content/body */
	body: string;
	/** Author's external user ID */
	authorExternalId: string;
	/** Message timestamp */
	timestamp: number;
	/** Parent message ID (for threads) */
	parentExternalId?: string;
	/** Channel/Container external ID */
	channelExternalId: string;
	/** File attachments */
	attachments?: ExternalAttachment[];
	/** Platform-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * File attachment from external platform
 */
export interface ExternalAttachment {
	/** External file ID */
	externalId: string;
	/** File name */
	name: string;
	/** MIME type */
	mimeType: string;
	/** File size in bytes */
	size: number;
	/** Download URL */
	url: string;
	/** Platform-specific metadata */
	metadata?: Record<string, unknown>;
}

/**
 * Pagination cursor for API calls
 */
export interface PaginationCursor {
	/** Next page cursor */
	nextCursor?: string;
	/** Has more pages? */
	hasMore: boolean;
}

/**
 * Paginated response
 */
export interface PaginatedResponse<T> {
	/** Items in this page */
	items: T[];
	/** Pagination info */
	pagination: PaginationCursor;
}

// ============================================================================
// IMPORT PROVIDER INTERFACE
// ============================================================================

/**
 * Interface that all import providers must implement.
 * This ensures a consistent structure across all platform imports.
 */
export interface ImportProvider {
	/**
	 * Platform identifier
	 */
	readonly platform: ImportPlatform;

	/**
	 * Validate the connection before starting import.
	 * Should verify the token is valid and has required scopes.
	 *
	 * @param ctx - Import context with credentials
	 * @throws Error if connection is invalid
	 */
	validateConnection(ctx: ImportContext): Promise<void>;

	/**
	 * Fetch workspace metadata from the external platform.
	 *
	 * @param ctx - Import context with credentials
	 * @returns Workspace metadata
	 */
	fetchWorkspace(ctx: ImportContext): Promise<WorkspaceMetadata>;

	/**
	 * Fetch users from the external platform.
	 * Should handle pagination internally.
	 *
	 * @param ctx - Import context with credentials
	 * @returns List of external users
	 */
	fetchUsers(ctx: ImportContext): Promise<ExternalUser[]>;

	/**
	 * Fetch channels/containers from the external platform.
	 * Should handle pagination internally.
	 *
	 * @param ctx - Import context with credentials
	 * @returns List of external channels
	 */
	fetchChannels(ctx: ImportContext): Promise<ExternalChannel[]>;

	/**
	 * Fetch messages for a specific channel.
	 * Should handle pagination internally.
	 *
	 * @param ctx - Import context with credentials
	 * @param channel - Channel to fetch messages from
	 * @returns Paginated response of messages
	 */
	fetchMessages(
		ctx: ImportContext,
		channel: ExternalChannel
	): Promise<PaginatedResponse<ExternalMessage>>;

	/**
	 * Fetch more messages using pagination cursor.
	 *
	 * @param ctx - Import context with credentials
	 * @param channel - Channel to fetch messages from
	 * @param cursor - Pagination cursor from previous response
	 * @returns Paginated response of messages
	 */
	fetchMessagesPage(
		ctx: ImportContext,
		channel: ExternalChannel,
		cursor: string
	): Promise<PaginatedResponse<ExternalMessage>>;

	/**
	 * Download a file attachment.
	 *
	 * @param ctx - Import context with credentials
	 * @param attachment - Attachment to download
	 * @returns File data as ArrayBuffer
	 */
	downloadFile(
		ctx: ImportContext,
		attachment: ExternalAttachment
	): Promise<ArrayBuffer>;

	/**
	 * Transform external user to internal format.
	 * Can be overridden for platform-specific logic.
	 *
	 * @param externalUser - User from external platform
	 * @param ctx - Import context
	 * @returns Transformed user data
	 */
	transformUser?(
		externalUser: ExternalUser,
		ctx: ImportContext
	): Promise<Partial<ExternalUser>>;

	/**
	 * Transform external channel to internal format.
	 * Can be overridden for platform-specific logic.
	 *
	 * @param externalChannel - Channel from external platform
	 * @param ctx - Import context
	 * @returns Transformed channel data
	 */
	transformChannel?(
		externalChannel: ExternalChannel,
		ctx: ImportContext
	): Promise<Partial<ExternalChannel>>;

	/**
	 * Transform external message to internal format.
	 * Can be overridden for platform-specific logic.
	 *
	 * @param externalMessage - Message from external platform
	 * @param ctx - Import context
	 * @returns Transformed message data
	 */
	transformMessage?(
		externalMessage: ExternalMessage,
		ctx: ImportContext
	): Promise<Partial<ExternalMessage>>;
}

// ============================================================================
// RATE LIMITER
// ============================================================================

/**
 * Rate limiter with exponential backoff.
 * Handles API rate limits gracefully.
 */
export class RateLimiter {
	/** Minimum delay between requests (ms) */
	private minDelay: number;
	/** Maximum delay between requests (ms) */
	private maxDelay: number;
	/** Current delay (ms) */
	private currentDelay: number;
	/** Last request timestamp */
	private lastRequestAt: number = 0;
	/** Rate limit info from last response */
	private rateLimitInfo?: RateLimitInfo;

	constructor(options?: { minDelay?: number; maxDelay?: number }) {
		this.minDelay = options?.minDelay ?? 100; // 100ms minimum
		this.maxDelay = options?.maxDelay ?? 60000; // 60s maximum
		this.currentDelay = this.minDelay;
	}

	/**
	 * Wait before making the next request.
	 * Respects rate limit headers and applies exponential backoff.
	 */
	async wait(): Promise<void> {
		// Check if we need to wait for rate limit reset
		if (this.rateLimitInfo) {
			const now = Date.now();
			if (this.rateLimitInfo.remaining <= 0) {
				const waitTime = Math.max(
					this.rateLimitInfo.retryAfter
						? this.rateLimitInfo.retryAfter * 1000
						: 0,
					this.rateLimitInfo.resetAt - now
				);
				if (waitTime > 0) {
					await this.sleep(Math.min(waitTime, this.maxDelay));
				}
				this.rateLimitInfo = undefined;
			}
		}

		// Apply minimum delay between requests
		const elapsed = Date.now() - this.lastRequestAt;
		if (elapsed < this.currentDelay) {
			await this.sleep(this.currentDelay - elapsed);
		}

		this.lastRequestAt = Date.now();
	}

	/**
	 * Record a successful request.
	 * Resets the backoff delay.
	 */
	recordSuccess(rateLimitInfo?: RateLimitInfo): void {
		this.rateLimitInfo = rateLimitInfo;
		// Reset delay on success
		this.currentDelay = this.minDelay;
	}

	/**
	 * Record a rate limit error.
	 * Increases the backoff delay.
	 */
	recordRateLimit(retryAfter?: number): void {
		if (retryAfter) {
			this.rateLimitInfo = {
				remaining: 0,
				resetAt: Date.now() + retryAfter * 1000,
				retryAfter,
			};
		}
		// Exponential backoff
		this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
	}

	/**
	 * Record a server error (5xx).
	 * Increases the backoff delay.
	 */
	recordServerError(): void {
		this.currentDelay = Math.min(this.currentDelay * 2, this.maxDelay);
	}

	private sleep(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}
}

// ============================================================================
// RETRY HANDLER
// ============================================================================

/**
 * Retry configuration
 */
export interface RetryConfig {
	/** Maximum number of retry attempts */
	maxAttempts: number;
	/** Initial delay between retries (ms) */
	initialDelay: number;
	/** Maximum delay between retries (ms) */
	maxDelay: number;
	/** Backoff multiplier */
	backoffMultiplier: number;
	/** Retry only on these HTTP status codes */
	retryStatusCodes?: number[];
	/** Retry on these error types */
	retryErrorTypes?: string[];
}

const DEFAULT_RETRY_CONFIG: RetryConfig = {
	maxAttempts: 5,
	initialDelay: 1000,
	maxDelay: 30000,
	backoffMultiplier: 2,
	retryStatusCodes: [408, 425, 429, 500, 502, 503, 504],
	retryErrorTypes: ["ECONNRESET", "ETIMEDOUT", "ECONNREFUSED", "AbortError"],
};

/**
 * Execute a function with retry logic.
 */
export async function withRetry<T>(
	fn: () => Promise<T>,
	config: Partial<RetryConfig> = {},
	onRetry?: (attempt: number, error: Error, delay: number) => Promise<void>
): Promise<T> {
	const {
		maxAttempts,
		initialDelay,
		maxDelay,
		backoffMultiplier,
		retryStatusCodes = DEFAULT_RETRY_CONFIG.retryStatusCodes!,
		retryErrorTypes = DEFAULT_RETRY_CONFIG.retryErrorTypes!,
	} = { ...DEFAULT_RETRY_CONFIG, ...config };

	let lastError: Error | undefined;
	let delay = initialDelay;

	for (let attempt = 1; attempt <= maxAttempts; attempt++) {
		try {
			return await fn();
		} catch (error) {
			lastError = error instanceof Error ? error : new Error(String(error));

			// Check if we should retry
			const shouldRetry = shouldRetryError(
				lastError,
				retryStatusCodes,
				retryErrorTypes
			);

			if (!shouldRetry || attempt === maxAttempts) {
				throw lastError;
			}

			// Call onRetry callback if provided
			if (onRetry) {
				await onRetry(attempt, lastError, delay);
			}

			// Wait before retrying
			await sleep(delay);

			// Increase delay for next attempt
			delay = Math.min(delay * backoffMultiplier, maxDelay);
		}
	}

	throw lastError;
}

/**
 * Check if an error should trigger a retry.
 */
function shouldRetryError(
	error: Error,
	retryStatusCodes: number[],
	retryErrorTypes: string[]
): boolean {
	// Check error type
	if (
		retryErrorTypes.some(
			(type) => error.name === type || error.message.includes(type)
		)
	) {
		return true;
	}

	// Check for HTTP status codes in error message
	const statusMatch = error.message.match(/status[:\s]*(\d+)/i);
	if (statusMatch) {
		const status = parseInt(statusMatch[1], 10);
		return retryStatusCodes.includes(status);
	}

	// Check for common retry indicators
	const retryIndicators = [
		"rate limit",
		"too many requests",
		"temporary failure",
		"try again",
		"timeout",
		"network",
	];

	return retryIndicators.some((indicator) =>
		error.message.toLowerCase().includes(indicator)
	);
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================================
// IDEMPOTENCY KEY GENERATOR
// ============================================================================

/**
 * Generate an idempotency key for a record.
 * Used to prevent duplicate imports on re-run.
 */
export function generateIdempotencyKey(
	platform: ImportPlatform,
	workspaceId: string,
	externalId: string,
	type: "user" | "channel" | "message" | "file"
): string {
	return `${platform}:${workspaceId}:${type}:${externalId}`;
}

/**
 * Parse an idempotency key.
 */
export function parseIdempotencyKey(key: string): {
	platform: ImportPlatform;
	workspaceId: string;
	type: "user" | "channel" | "message" | "file";
	externalId: string;
} | null {
	const parts = key.split(":");
	if (parts.length !== 4) return null;

	const [platform, workspaceId, type, externalId] = parts;

	if (!isValidPlatform(platform) || !isValidType(type)) {
		return null;
	}

	return {
		platform: platform as ImportPlatform,
		workspaceId,
		type: type as "user" | "channel" | "message" | "file",
		externalId,
	};
}

function isValidPlatform(platform: string): platform is ImportPlatform {
	return ["slack", "todoist", "linear", "notion", "miro", "clickup"].includes(
		platform
	);
}

function isValidType(
	type: string
): type is "user" | "channel" | "message" | "file" {
	return ["user", "channel", "message", "file"].includes(type);
}

// ============================================================================
// IMPORT UTILITIES
// ============================================================================

/**
 * Check if a token is expired or about to expire.
 */
export function isTokenExpired(
	expiresAt?: number,
	bufferMs: number = 60000
): boolean {
	if (!expiresAt) return false;
	return Date.now() + bufferMs >= expiresAt;
}

/**
 * Parse rate limit headers from a Response object.
 */
export function parseRateLimitHeaders(
	response: Response
): RateLimitInfo | undefined {
	const headers = response.headers;

	const remaining = headers.get("x-ratelimit-remaining");
	const reset = headers.get("x-ratelimit-reset");
	const retryAfter = headers.get("retry-after");

	if (!remaining && !reset && !retryAfter) {
		return undefined;
	}

	return {
		remaining: remaining ? parseInt(remaining, 10) : 0,
		resetAt: reset ? parseInt(reset, 10) * 1000 : Date.now(),
		retryAfter: retryAfter ? parseInt(retryAfter, 10) : undefined,
	};
}

/**
 * Safely parse JSON from a Response, handling empty bodies.
 */
export async function safeJsonResponse<T>(
	response: Response
): Promise<T | null> {
	const text = await response.text();
	if (!text) return null;
	try {
		return JSON.parse(text) as T;
	} catch {
		return null;
	}
}

/**
 * Chunk an array into smaller arrays.
 */
export function chunkArray<T>(array: T[], size: number): T[][] {
	const chunks: T[][] = [];
	for (let i = 0; i < array.length; i += size) {
		chunks.push(array.slice(i, i + size));
	}
	return chunks;
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
	const seconds = Math.floor(ms / 1000);
	const minutes = Math.floor(seconds / 60);
	const hours = Math.floor(minutes / 60);

	if (hours > 0) {
		return `${hours}h ${minutes % 60}m`;
	}
	if (minutes > 0) {
		return `${minutes}m ${seconds % 60}s`;
	}
	return `${seconds}s`;
}
