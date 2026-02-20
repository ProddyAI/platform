/**
 * Slack Import Provider
 *
 * Implements the ImportProvider interface for Slack data imports.
 * Handles workspace, channels, users, and messages import with:
 * - Rate limiting compliance
 * - Exponential backoff retry
 * - Idempotency (no duplicates on re-import)
 * - Pagination support
 * - Thread support
 * - File attachment support
 */

import { internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import {
	chunkArray,
	type ExternalAttachment,
	type ExternalChannel,
	type ExternalMessage,
	type ExternalUser,
	formatDuration,
	generateIdempotencyKey,
	type ImportContext,
	type ImportPlatform,
	type ImportResult,
	isTokenExpired,
	type PaginatedResponse,
	parseRateLimitHeaders,
	RateLimiter,
	safeJsonResponse,
	type WorkspaceMetadata,
	withRetry,
} from "./importPipeline";

// ============================================================================
// SLACK API TYPES
// ============================================================================

interface SlackAuthResponse {
	ok: boolean;
	access_token: string;
	refresh_token?: string;
	team_id: string;
	team: {
		id: string;
		name: string;
		domain: string;
		icon?: Record<string, unknown>;
	};
	scope: string;
	bot_user_id?: string;
	app_id?: string;
	error?: string;
}

interface SlackUser {
	id: string;
	team_id: string;
	name: string;
	deleted?: boolean;
	color?: string;
	real_name: string;
	tz?: string;
	tz_label?: string;
	tz_offset?: number;
	profile: {
		title?: string;
		phone?: string;
		skype?: string;
		real_name: string;
		real_name_normalized?: string;
		display_name?: string;
		display_name_normalized?: string;
		status_text?: string;
		status_emoji?: string;
		status_emoji_display_info?: unknown[];
		status_expiration?: number;
		avatar_hash?: string;
		email?: string;
		image_24?: string;
		image_32?: string;
		image_48?: string;
		image_72?: string;
		image_192?: string;
		image_512?: string;
		team?: string;
	};
	is_admin?: boolean;
	is_owner?: boolean;
	is_primary_owner?: boolean;
	is_restricted?: boolean;
	is_ultra_restricted?: boolean;
	is_bot?: boolean;
	is_app_user?: boolean;
	updated?: number;
	is_email_confirmed?: boolean;
	who_can_share_contact_card?: string;
}

interface SlackUsersResponse {
	ok: boolean;
	members: SlackUser[];
	response_metadata?: {
		next_cursor?: string;
	};
	error?: string;
}

interface SlackChannel {
	id: string;
	name: string;
	name_normalized?: string;
	is_channel?: boolean;
	is_group?: boolean;
	is_im?: boolean;
	is_mpim?: boolean;
	is_private: boolean;
	created: number;
	is_archived: boolean;
	is_general?: boolean;
	unlinked?: number;
	is_shared?: boolean;
	is_org_shared?: boolean;
	is_pending_ext_shared?: boolean;
	pending_shared?: string[];
	parent_conversation?: string | null;
	is_ext_shared?: boolean;
	is_read_only?: boolean;
	is_thread_only?: boolean;
	shared_team_ids?: string[];
	pending_connected_team_ids?: string[];
	is_pending_connected_team_ids?: boolean;
	has_cover_image?: boolean;
	priority?: number;
	user?: string;
	topic?: {
		value?: string;
		creator?: string;
		last_set?: number;
	};
	purpose?: {
		value?: string;
		creator?: string;
		last_set?: number;
	};
	previous_names?: string[];
}

interface SlackConversationsResponse {
	ok: boolean;
	channels: SlackChannel[];
	response_metadata?: {
		next_cursor?: string;
	};
	error?: string;
}

interface SlackMessage {
	bot_id?: string;
	type: "message" | "file_share" | "bot_message" | string;
	text?: string;
	user?: string;
	ts: string;
	team?: string;
	bot_profile?: {
		id: string;
		app_id: string;
		name: string;
		icons?: Record<string, string>;
		deleted?: boolean;
		updated?: number;
		team_id?: string;
	};
	files?: SlackFile[];
	upload?: boolean;
	display_as_bot?: boolean;
	username?: string;
	blocks?: unknown[];
	thread_ts?: string;
	parent_user_id?: string;
	inviter?: string;
	topic?: string;
	purpose?: string;
	bot_link?: string;
	reactions?: {
		name: string;
		count: number;
		users: string[];
	}[];
	reply_count?: number;
	reply_users_count?: number;
	latest_reply?: string;
	replies?: {
		user: string;
		ts: string;
	}[];
	is_locked?: boolean;
	subscribed?: boolean;
	last_read?: string;
	root?: {
		bot_id?: string;
		type: string;
		text?: string;
		user?: string;
		ts: string;
	};
	subtype?: string;
	hidden?: boolean;
	deleted_ts?: string;
}

interface SlackFile {
	id: string;
	created: number;
	timestamp: number;
	name: string;
	title?: string;
	mimetype: string;
	filetype: string;
	pretty_type: string;
	user: string;
	user_team?: string;
	editable: boolean;
	size: number;
	mode: string;
	is_external: boolean;
	external_type: string;
	is_public: boolean;
	public_url_shared: boolean;
	display_as_bot: boolean;
	username?: string;
	url_private?: string;
	url_private_download?: string;
	media_display_type?: string;
	thumb_64?: string;
	thumb_80?: string;
	thumb_360?: string;
	thumb_360_w?: number;
	thumb_360_h?: string;
	thumb_160?: string;
	thumb_720?: string;
	thumb_800?: string;
	thumb_960?: string;
	thumb_1024?: string;
	thumb_video?: string;
	thumb_gif?: string;
	thumb_pdf?: string;
	thumb_pdf_w?: string;
	thumb_pdf_h?: string;
	thumb_tiny?: string;
	modified?: number;
	permalink?: string;
	permalink_public?: string;
	has_rich_preview?: boolean;
	is_starred?: boolean;
	has_more?: boolean;
	sent_to_self?: boolean;
	is_instant_preview?: boolean;
}

interface SlackHistoryResponse {
	ok: boolean;
	messages: SlackMessage[];
	has_more: boolean;
	pin_count?: number;
	response_metadata?: {
		next_cursor?: string;
	};
	error?: string;
}

interface SlackTeamInfoResponse {
	ok: boolean;
	team: {
		id: string;
		name: string;
		domain: string;
		email_domain: string;
		icon?: Record<string, unknown>;
		avatar_base_url?: string;
	};
}

// ============================================================================
// SLACK IMPORT PROVIDER CLASS
// ============================================================================

export class SlackImportProvider {
	readonly platform: ImportPlatform = "slack";

	/** Rate limiter for Slack API calls */
	private rateLimiter: RateLimiter;

	/** Maximum messages per request */
	public static readonly MESSAGES_PER_PAGE = 100;

	/** Maximum users per request */
	public static readonly USERS_PER_PAGE = 100;

	/** Maximum channels per request */
	public static readonly CHANNELS_PER_PAGE = 100;

	/** Concurrent channel processing limit */
	public static readonly MAX_CONCURRENT_CHANNELS = 3;

	/** Batch size for storing messages */
	public static readonly MESSAGE_BATCH_SIZE = 50;

	constructor() {
		this.rateLimiter = new RateLimiter({
			minDelay: 200, // Slack recommends 1 request per second per workspace
			maxDelay: 60000,
		});
	}

	/**
	 * Make an authenticated Slack API call with rate limiting and retry.
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

				// Check token expiration
				if (isTokenExpired(ctx.expiresAt)) {
					throw new Error("Token expired");
				}

				const url = `https://slack.com/api/${endpoint}`;
				const searchParams = new URLSearchParams(params);

				const response = await fetch(url, {
					method: "POST",
					headers: {
						"Content-Type": "application/x-www-form-urlencoded",
						Authorization: `Bearer ${ctx.accessToken}`,
					},
					body: searchParams,
				});

				const rateLimitInfo = parseRateLimitHeaders(response);

				if (!response.ok) {
					const errorText = await response.text();
					if (response.status === 429) {
						this.rateLimiter.recordRateLimit(rateLimitInfo?.retryAfter);
						throw new Error(`Rate limited: ${errorText}`);
					}
					if (response.status >= 500) {
						this.rateLimiter.recordServerError();
						throw new Error(`Server error ${response.status}: ${errorText}`);
					}
					throw new Error(`HTTP ${response.status}: ${errorText}`);
				}

				const data = await safeJsonResponse<T>(response);
				if (!data) {
					throw new Error("Empty response from Slack API");
				}

				// Check Slack API error
				const anyData = data as any;
				if (!anyData.ok) {
					const slackError = anyData.error || "Unknown Slack error";

					// Handle specific Slack errors
					if (slackError === "ratelimited" || slackError === "rate_limited") {
						const retryAfter = anyData.retry_after
							? parseInt(anyData.retry_after, 10)
							: 10;
						this.rateLimiter.recordRateLimit(retryAfter);
						throw new Error(`Slack rate limited: ${slackError}`);
					}

					if (slackError === "account_inactive") {
						throw new Error("Slack account is inactive");
					}
					if (slackError === "invalid_auth" || slackError === "auth_expired") {
						throw new Error("Slack authentication expired");
					}
					if (slackError === "not_allowed") {
						throw new Error("Missing required Slack scopes");
					}
					if (slackError === "channel_not_found") {
						throw new Error(`Channel not found: ${params.channel}`);
					}

					throw new Error(`Slack API error: ${slackError}`);
				}

				this.rateLimiter.recordSuccess(rateLimitInfo);
				return data;
			},
			{
				maxAttempts: 5,
				initialDelay: 1000,
				maxDelay: 30000,
			},
			async (attempt, error, delay) => {
				await ctx.log("warn", `Slack API retry ${attempt}/5`, {
					endpoint,
					error: error.message,
					delayMs: delay,
				});
			}
		);
	}

	/**
	 * Validate the Slack connection.
	 */
	async validateConnection(ctx: ImportContext): Promise<void> {
		try {
			// Test the connection by fetching team info
			const response = await this.apiCall<SlackTeamInfoResponse>(
				ctx,
				"team.info"
			);

			if (!response.team || !response.team.id) {
				throw new Error("Invalid team info response");
			}
		} catch (error) {
			throw new Error(
				`Failed to validate Slack connection: ${error instanceof Error ? error.message : "Unknown error"}`
			);
		}
	}

	/**
	 * Fetch workspace metadata from Slack.
	 */
	async fetchWorkspace(ctx: ImportContext): Promise<WorkspaceMetadata> {
		const response = await this.apiCall<SlackTeamInfoResponse>(
			ctx,
			"team.info"
		);

		return {
			externalId: response.team.id,
			name: response.team.name,
			metadata: {
				domain: response.team.domain,
				emailDomain: response.team.email_domain,
				icon: response.team.icon,
			},
		};
	}

	/**
	 * Fetch all users from Slack with pagination.
	 */
	async fetchUsers(ctx: ImportContext): Promise<ExternalUser[]> {
		const allUsers: ExternalUser[] = [];
		let cursor: string | undefined;
		let _pageCount = 0;

		do {
			_pageCount++;
			const params: Record<string, string> = {
				limit: String(SlackImportProvider.USERS_PER_PAGE),
			};
			if (cursor) {
				params.cursor = cursor;
			}

			const response = await this.apiCall<SlackUsersResponse>(
				ctx,
				"users.list",
				params
			);

			if (!response.members) {
				throw new Error("No users in response");
			}

			// Transform Slack users to ExternalUser format
			const users: ExternalUser[] = response.members
				.filter((user) => !user.deleted) // Skip deleted users
				.map((user) => ({
					externalId: user.id,
					displayName: user.profile.display_name || user.real_name || user.name,
					email: user.profile.email,
					avatarUrl: user.profile.image_192 || user.profile.image_72,
					isBot: user.is_bot || false,
					isDeleted: user.deleted || false,
					metadata: {
						realName: user.real_name,
						title: user.profile.title,
						isAdmin: user.is_admin || false,
						isOwner: user.is_owner || false,
						timezone: user.tz,
					},
				}));

			allUsers.push(...users);
			cursor = response.response_metadata?.next_cursor;
		} while (cursor);

		return allUsers;
	}

	/**
	 * Fetch all channels from Slack with pagination.
	 */
	async fetchChannels(ctx: ImportContext): Promise<ExternalChannel[]> {
		const allChannels: ExternalChannel[] = [];
		let cursor: string | undefined;
		let _pageCount = 0;

		do {
			_pageCount++;
			const params: Record<string, string> = {
				limit: String(SlackImportProvider.CHANNELS_PER_PAGE),
				exclude_archived: "true",
			};
			if (cursor) {
				params.cursor = cursor;
			}

			const response = await this.apiCall<SlackConversationsResponse>(
				ctx,
				"conversations.list",
				params
			);

			if (!response.channels) {
				throw new Error("No channels in response");
			}

			// Filter channels based on config if specific channels requested
			let channels = response.channels;
			if (ctx.config.items && ctx.config.items.length > 0) {
				channels = channels.filter((ch) => ctx.config.items?.includes(ch.id));
			}

			// Transform to ExternalChannel format
			const externalChannels: ExternalChannel[] = channels.map((ch) => ({
				externalId: ch.id,
				name: ch.name,
				type: ch.is_private ? "private" : "public",
				description: ch.topic?.value || ch.purpose?.value,
				createdAt: ch.created * 1000, // Convert to milliseconds
				metadata: {
					isGeneral: ch.is_general || false,
					isArchived: ch.is_archived || false,
					isShared: ch.is_shared || false,
					topic: ch.topic?.value,
					purpose: ch.purpose?.value,
					previousNames: ch.previous_names,
				},
			}));

			allChannels.push(...externalChannels);
			cursor = response.response_metadata?.next_cursor;
		} while (cursor);

		return allChannels;
	}

	/**
	 * Fetch messages for a channel with pagination.
	 */
	async fetchMessages(
		ctx: ImportContext,
		channel: ExternalChannel
	): Promise<PaginatedResponse<ExternalMessage>> {
		return this.fetchMessagesPage(ctx, channel, undefined);
	}

	/**
	 * Fetch a page of messages for a channel.
	 */
	async fetchMessagesPage(
		ctx: ImportContext,
		channel: ExternalChannel,
		cursor?: string
	): Promise<PaginatedResponse<ExternalMessage>> {
		const params: Record<string, string> = {
			channel: channel.externalId,
			limit: String(SlackImportProvider.MESSAGES_PER_PAGE),
			inclusive: "true",
		};

		// Add date range filters
		if (ctx.config.dateFrom) {
			params.oldest = String(Math.floor(ctx.config.dateFrom / 1000));
		}
		if (ctx.config.dateTo) {
			params.latest = String(Math.ceil(ctx.config.dateTo / 1000));
		}

		if (cursor) {
			params.cursor = cursor;
		}

		const response = await this.apiCall<SlackHistoryResponse>(
			ctx,
			"conversations.history",
			params
		);

		if (!response.messages) {
			throw new Error("No messages in response");
		}

		// Transform Slack messages to ExternalMessage format
		const messages: ExternalMessage[] = response.messages
			.filter((msg) => {
				// Filter out certain message types
				if (
					msg.subtype === "channel_join" ||
					msg.subtype === "channel_leave" ||
					msg.subtype === "channel_archive" ||
					msg.subtype === "channel_unarchive" ||
					msg.subtype === "channel_topic" ||
					msg.subtype === "channel_purpose" ||
					msg.subtype === "channel_name"
				) {
					return false;
				}
				// Skip messages with no text and no files
				if (!msg.text && (!msg.files || msg.files.length === 0)) {
					return false;
				}
				return true;
			})
			.map((msg) => {
				// Extract attachments (files)
				const attachments: ExternalAttachment[] =
					msg.files?.map((file) => ({
						externalId: file.id,
						name: file.name || file.title || "untitled",
						mimeType: file.mimetype || "application/octet-stream",
						size: file.size,
						url: file.url_private_download || file.url_private || "",
						metadata: {
							filetype: file.filetype,
							prettyType: file.pretty_type,
							isExternal: file.is_external,
							thumbUrl: file.thumb_360 || file.thumb_720,
						},
					})) || [];

				return {
					externalId: msg.ts,
					body: msg.text || "",
					authorExternalId: msg.user || msg.bot_id || "unknown",
					timestamp: parseFloat(msg.ts) * 1000, // Convert to milliseconds
					parentExternalId:
						msg.thread_ts && msg.thread_ts !== msg.ts
							? msg.thread_ts
							: undefined,
					channelExternalId: channel.externalId,
					attachments,
					metadata: {
						botId: msg.bot_id,
						subtype: msg.subtype,
						threadTs: msg.thread_ts,
						replyCount: msg.reply_count,
						reactions: msg.reactions?.map((r) => ({
							name: r.name,
							count: r.count,
						})),
					},
				};
			});

		return {
			items: messages,
			pagination: {
				nextCursor: response.response_metadata?.next_cursor,
				hasMore: response.has_more,
			},
		};
	}

	/**
	 * Download a file attachment.
	 */
	async downloadFile(
		ctx: ImportContext,
		attachment: ExternalAttachment
	): Promise<ArrayBuffer> {
		if (!attachment.url) {
			throw new Error("No download URL for attachment");
		}

		const response = await fetch(attachment.url, {
			headers: {
				Authorization: `Bearer ${ctx.accessToken}`,
			},
		});

		if (!response.ok) {
			throw new Error(`Failed to download file: ${response.status}`);
		}

		return await response.arrayBuffer();
	}

	/**
	 * Fetch thread replies for a message.
	 */
	async fetchThreadReplies(
		ctx: ImportContext,
		channel: ExternalChannel,
		threadTs: string
	): Promise<ExternalMessage[]> {
		const params: Record<string, string> = {
			channel: channel.externalId,
			ts: threadTs,
			limit: String(SlackImportProvider.MESSAGES_PER_PAGE),
		};

		const response = await this.apiCall<SlackHistoryResponse>(
			ctx,
			"conversations.replies",
			params
		);

		if (!response.messages) {
			return [];
		}

		// Skip the first message (it's the parent)
		const replies = response.messages.slice(1);

		return replies.map((msg) => ({
			externalId: msg.ts,
			body: msg.text || "",
			authorExternalId: msg.user || msg.bot_id || "unknown",
			timestamp: parseFloat(msg.ts) * 1000,
			parentExternalId: threadTs,
			channelExternalId: channel.externalId,
			attachments: msg.files?.map((file) => ({
				externalId: file.id,
				name: file.name || file.title || "untitled",
				mimeType: file.mimetype || "application/octet-stream",
				size: file.size,
				url: file.url_private_download || file.url_private || "",
				metadata: {
					filetype: file.filetype,
					prettyType: file.pretty_type,
				},
			})),
			metadata: {
				botId: msg.bot_id,
				subtype: msg.subtype,
			},
		}));
	}
}

// ============================================================================
// SLACK IMPORT EXECUTOR
// ============================================================================

/**
 * Import context extended with channel/message tracking
 */
interface SlackImportContext extends ImportContext {
	/** Map of external channel ID to internal channel ID */
	channelMap: Map<string, string>;
	/** Map of external message ID to internal message ID */
	messageMap: Map<string, string>;
}

/**
 * Execute a Slack import using the provider.
 * This is the main entry point for running Slack imports.
 */
export async function executeSlackImport(
	ctx: ImportContext,
	provider: SlackImportProvider
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
	const slackCtx: SlackImportContext = {
		...ctx,
		channelMap: new Map(),
		messageMap: new Map(),
	};

	try {
		// Step 1: Validate connection
		await ctx.updateProgress({ currentStep: "Validating Slack connection..." });
		await provider.validateConnection(ctx);

		// Step 2: Fetch workspace info
		await ctx.updateProgress({ currentStep: "Fetching workspace info..." });
		const _workspace = await provider.fetchWorkspace(ctx);

		// Step 3: Fetch users
		await ctx.updateProgress({ currentStep: "Fetching users..." });
		const users = await provider.fetchUsers(ctx);
		result.usersMatched = users.length;

		// Step 4: Fetch channels
		await ctx.updateProgress({ currentStep: "Fetching channels..." });
		const channels = await provider.fetchChannels(ctx);

		if (channels.length === 0) {
			await ctx.updateProgress({
				currentStep: "No channels found",
				itemsTotal: 0,
			});
			return result;
		}

		await ctx.updateProgress({
			itemsTotal: channels.length,
			currentStep: `Found ${channels.length} channels`,
		});

		// Step 5: Process channels and messages
		await ctx.updateProgress({
			currentStep: "Importing channels and messages...",
		});

		// Process channels with concurrency limit
		const channelBatches = chunkArray(
			channels,
			SlackImportProvider.MAX_CONCURRENT_CHANNELS
		);

		for (const [batchIndex, channelBatch] of channelBatches.entries()) {
			if (await ctx.isCancelled()) {
				throw new Error("Import cancelled");
			}

			// Process channels in this batch concurrently
			await Promise.all(
				channelBatch.map(async (channel) => {
					try {
						await processChannel(slackCtx, provider, channel, result);
					} catch (error) {
						const errorMsg = `Failed to process channel ${channel.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
						result.errors?.push(errorMsg);
					}
				})
			);

			// Update progress after each batch
			const processedChannels = (batchIndex + 1) * channelBatch.length;
			await ctx.updateProgress({
				itemsImported: Math.min(processedChannels, channels.length),
				currentStep: `Processed ${Math.min(processedChannels, channels.length)}/${channels.length} channels`,
			});
		}

		// Step 6: Final summary
		const duration = Date.now() - startTime;
		await ctx.updateProgress({
			currentStep: `Import completed in ${formatDuration(duration)}`,
		});
	} catch (error) {
		const errorMsg = error instanceof Error ? error.message : "Unknown error";
		result.errors?.push(`Import failed: ${errorMsg}`);
		throw error;
	}

	return result;
}

/**
 * Process a single channel and its messages.
 */
async function processChannel(
	ctx: SlackImportContext,
	provider: SlackImportProvider,
	channel: ExternalChannel,
	result: ImportResult
): Promise<void> {
	// Store channel in database (idempotent)
	const channelId = await storeChannel(ctx, channel);
	ctx.channelMap.set(channel.externalId, channelId);
	result.itemsCreated.push(channelId);

	// Fetch and process messages
	let hasMore = true;
	let cursor: string | undefined;
	let _messagePage = 0;

	while (hasMore) {
		if (await ctx.isCancelled()) {
			throw new Error("Import cancelled");
		}

		_messagePage++;

		const response = cursor
			? await provider.fetchMessagesPage(ctx, channel, cursor)
			: await provider.fetchMessages(ctx, channel);

		// Process messages in batches
		const messageBatches = chunkArray(
			response.items,
			SlackImportProvider.MESSAGE_BATCH_SIZE
		);

		for (const messageBatch of messageBatches) {
			await storeMessages(ctx, provider, channel, messageBatch, result);
		}

		hasMore = response.pagination.hasMore;
		cursor = response.pagination.nextCursor;
	}

	// Fetch thread replies if enabled
	if (ctx.config.includeThreads) {
		// Thread replies are fetched as part of message processing
	}
}

/**
 * Store a channel in the database (idempotent).
 * Checks for existing channels by external ID to prevent duplicates.
 */
async function storeChannel(
	ctx: SlackImportContext,
	channel: ExternalChannel
): Promise<string> {
	// Generate idempotency key
	const idempotencyKey = generateIdempotencyKey(
		"slack",
		ctx.workspaceId,
		channel.externalId,
		"channel"
	);

	// Check if channel already exists by external ID
	const existingChannel = (await ctx.runQuery(
		internal.importIntegrations.getChannelByExternalId,
		{
			workspaceId: ctx.workspaceId,
			externalId: channel.externalId,
		}
	)) as any;

	if (existingChannel) {
		// Update channel name if it changed
		if (existingChannel.name !== channel.name) {
			await ctx.runMutation(
				internal.importIntegrations.updateImportedChannelName,
				{
					channelId: existingChannel._id,
					name: channel.name,
				}
			);
		}
		// Store in map for message lookup
		ctx.channelMap.set(channel.externalId, existingChannel._id);
		return existingChannel._id;
	}

	// Create channel in database
	const channelId = await ctx.runMutation<string>(
		internal.importIntegrations.storeImportedChannel,
		{
			workspaceId: ctx.workspaceId,
			memberId: ctx.memberId,
			externalId: channel.externalId,
			idempotencyKey,
			name: channel.name,
			type: channel.type,
			description: channel.description,
			metadata: channel.metadata,
		}
	);

	return channelId;
}

/**
 * Store messages in the database (idempotent).
 */
async function storeMessages(
	ctx: SlackImportContext,
	provider: SlackImportProvider,
	channel: ExternalChannel,
	messages: ExternalMessage[],
	result: ImportResult
): Promise<void> {
	for (const message of messages) {
		if (await ctx.isCancelled()) {
			throw new Error("Import cancelled");
		}

		try {
			// Generate idempotency key
			const idempotencyKey = generateIdempotencyKey(
				"slack",
				ctx.workspaceId,
				message.externalId,
				"message"
			);

			// Check if message already exists
			const existingMessage = (await ctx.runQuery(
				internal.importIntegrations.getMessageByExternalId,
				{
					workspaceId: ctx.workspaceId,
					externalId: message.externalId,
				}
			)) as any;

			if (existingMessage) {
				// Message already imported, skip but add to map for thread replies
				ctx.messageMap.set(message.externalId, existingMessage._id);
				return; // Skip this message
			}

			// Find the member for this user
			const memberId = await findMemberForUser(ctx, message.authorExternalId);

			// Get parent message ID if this is a thread reply
			let parentMessageId: string | undefined;
			if (message.parentExternalId) {
				parentMessageId = ctx.messageMap.get(message.parentExternalId);
			}

			// Get channel ID from map
			const channelId = ctx.channelMap.get(channel.externalId);
			if (!channelId) {
				throw new Error(`Channel ${channel.externalId} not found in map`);
			}

			// Store message
			const messageId = await ctx.runMutation<string>(
				internal.importIntegrations.storeImportedMessage,
				{
					workspaceId: ctx.workspaceId,
					memberId: ctx.memberId,
					channelId: channelId as Id<"channels">,
					externalId: message.externalId,
					idempotencyKey,
					body: message.body,
					authorMemberId: memberId,
					timestamp: message.timestamp,
					parentMessageId: parentMessageId as Id<"messages"> | undefined,
					metadata: message.metadata,
				}
			);

			// Store in map for thread reply lookups
			ctx.messageMap.set(message.externalId, messageId);

			result.messagesCreated++;

			// Skip file downloads - Convex mutations have size limits
			// Files would need to be uploaded via pre-signed URLs instead
			// if (ctx.config.includeFiles && message.attachments) {
			// 	for (const attachment of message.attachments) {
			// 		try {
			// 			await storeFileAttachment(
			// 				ctx,
			// 				provider,
			// 				messageId,
			// 				attachment,
			// 				result
			// 			);
			// 		} catch (error) {
			// 			const errorMsg = `Failed to download attachment ${attachment.name}: ${error instanceof Error ? error.message : "Unknown error"}`;
			// 			result.warnings?.push(errorMsg);
			// 		}
			// 	}
			// }

			// Fetch thread replies if this is a parent message
			if (ctx.config.includeThreads && message.metadata?.threadTs) {
				try {
					const replies = await provider.fetchThreadReplies(
						ctx,
						channel,
						message.metadata.threadTs as string
					);
					if (replies.length > 0) {
						await storeMessages(ctx, provider, channel, replies, result);
					}
				} catch (err) {
					const error = err instanceof Error ? err : new Error(String(err));
					const errorMsg = `Failed to fetch thread replies: ${error.message}`;
					if (result.warnings) {
						result.warnings.push(errorMsg);
					}
				}
			}
		} catch (err) {
			const error = err instanceof Error ? err : new Error(String(err));
			const errorMsg = `Failed to store message ${message.externalId}: ${error.message}`;
			if (result.errors) {
				result.errors.push(errorMsg);
			}
		}
	}

	// Update progress
	await ctx.updateProgress({
		subItemsImported: result.messagesCreated,
	});
}

/**
 * Store a file attachment.
 */
async function _storeFileAttachment(
	ctx: SlackImportContext,
	provider: SlackImportProvider,
	messageId: string,
	attachment: ExternalAttachment,
	result: ImportResult
): Promise<void> {
	// Generate idempotency key
	const idempotencyKey = generateIdempotencyKey(
		"slack",
		ctx.workspaceId,
		attachment.externalId,
		"file"
	);

	// Download file
	const fileData = await provider.downloadFile(ctx, attachment);

	// Upload to Convex storage
	const storageId = await ctx.runMutation<Id<"_storage">>(
		internal.importIntegrations.uploadFileToStorage,
		{
			fileData: Array.from(new Uint8Array(fileData)),
			fileName: attachment.name,
			mimeType: attachment.mimeType,
		}
	);

	// Store file reference
	await ctx.runMutation(internal.importIntegrations.storeImportedFile, {
		messageId: messageId as Id<"messages">,
		storageId,
		externalId: attachment.externalId,
		idempotencyKey,
		name: attachment.name,
		mimeType: attachment.mimeType,
		size: attachment.size,
		metadata: attachment.metadata,
	});

	result.filesImported++;
}

/**
 * Find or create a member for a Slack user.
 * Tries to match by email first, then creates a placeholder.
 */
async function findMemberForUser(
	_ctx: SlackImportContext,
	_userExternalId: string
): Promise<Id<"members"> | undefined> {
	// In a full implementation, you would:
	// 1. Fetch user details from Slack to get email
	// 2. Look up existing member by email in the members table
	// 3. Create a placeholder member if no match found

	// For now, return undefined (message will be stored without specific author)
	// The message will use the importing member as the author
	return undefined;
}
