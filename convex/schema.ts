import { authTables } from '@convex-dev/auth/server';
import { defineSchema, defineTable } from 'convex/server';
import { v } from 'convex/values';

const schema = defineSchema({
	...authTables,
	// Extend the users table with additional profile fields
	users: defineTable({
		name: v.optional(v.string()),
		image: v.optional(v.string()),
		banner: v.optional(v.union(v.string(), v.null())),
		email: v.optional(v.string()),
		emailVerificationTime: v.optional(v.number()),
		phone: v.optional(v.string()),
		phoneVerificationTime: v.optional(v.number()),
		isAnonymous: v.optional(v.boolean()),
		// Additional profile fields
		bio: v.optional(v.string()),
		location: v.optional(v.string()),
		website: v.optional(v.string()),
	}).index('email', ['email']),

	workspaces: defineTable({
		name: v.string(),
		userId: v.id('users'),
		joinCode: v.string(),
	}).index('by_user_id', ['userId']),

	members: defineTable({
		userId: v.id('users'),
		workspaceId: v.id('workspaces'),
		role: v.union(v.literal('owner'), v.literal('admin'), v.literal('member')),
	})
		.index('by_user_id', ['userId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_id_user_id', ['workspaceId', 'userId']),

	channels: defineTable({
		name: v.string(),
		workspaceId: v.id('workspaces'),
		icon: v.optional(v.string()), // Store emoji as string
		iconImage: v.optional(v.id('_storage')), // Store uploaded image
	}).index('by_workspace_id', ['workspaceId']),

	conversations: defineTable({
		workspaceId: v.id('workspaces'),
		memberOneId: v.id('members'),
		memberTwoId: v.id('members'),
	}).index('by_workspace_id', ['workspaceId']),

	messages: defineTable({
		body: v.string(),
		image: v.optional(v.id('_storage')),
		memberId: v.id('members'),
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		parentMessageId: v.optional(v.id('messages')),
		conversationId: v.optional(v.id('conversations')),
		updatedAt: v.optional(v.number()),
		tags: v.optional(v.array(v.string())), // Added tags support for canvas messages
		calendarEvent: v.optional(
			v.object({
				date: v.number(), // timestamp for the event date
				time: v.optional(v.string()), // optional time string
			})
		),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_member_id', ['memberId'])
		.index('by_channel_id', ['channelId'])
		.index('by_conversation_id', ['conversationId'])
		.index('by_parent_message_id', ['parentMessageId'])
		.index('by_channel_id_parent_message_id_conversation_id', [
			'channelId',
			'parentMessageId',
			'conversationId',
		]),

	events: defineTable({
		title: v.string(),
		date: v.number(), // timestamp for the event date
		time: v.optional(v.string()), // optional time string
		messageId: v.id('messages'),
		memberId: v.id('members'),
		workspaceId: v.id('workspaces'),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_date', ['date'])
		.index('by_message_id', ['messageId'])
		.index('by_member_id', ['memberId']),

	reactions: defineTable({
		workspaceId: v.id('workspaces'),
		messageId: v.id('messages'),
		memberId: v.id('members'),
		value: v.string(),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_message_id', ['messageId'])
		.index('by_member_id', ['memberId']),

	// Combined history and presence tables
	history: defineTable({
		userId: v.id('users'),
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')), // Optional for channel-specific presence
		status: v.string(), // "online", "offline", "active", "inactive"
		lastSeen: v.number(), // timestamp
	})
		.index('by_user_id', ['userId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_id_user_id', ['workspaceId', 'userId'])
		.index('by_channel_id', ['channelId'])
		.index('by_workspace_channel', ['workspaceId', 'channelId']),

	lists: defineTable({
		channelId: v.id('channels'),
		title: v.string(),
		order: v.number(),
	})
		.index('by_channel_id', ['channelId'])
		.index('by_channel_id_order', ['channelId', 'order']),

	cards: defineTable({
		listId: v.id('lists'),
		title: v.string(),
		description: v.optional(v.string()),
		order: v.number(),
		labels: v.optional(v.array(v.string())),
		priority: v.optional(
			v.union(
				v.literal('lowest'),
				v.literal('low'),
				v.literal('medium'),
				v.literal('high'),
				v.literal('highest')
			)
		),
		dueDate: v.optional(v.number()),
		assignees: v.optional(v.array(v.id('members'))),
	}).index('by_list_id', ['listId']),

	categories: defineTable({
		name: v.string(),
		color: v.string(),
		workspaceId: v.id('workspaces'),
		userId: v.id('users'),
		isDefault: v.optional(v.boolean()),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_id_user_id', ['workspaceId', 'userId']),

	tasks: defineTable({
		title: v.string(),
		description: v.optional(v.string()),
		completed: v.boolean(),
		status: v.optional(
			v.union(
				v.literal('not_started'),
				v.literal('in_progress'),
				v.literal('completed'),
				v.literal('on_hold'),
				v.literal('cancelled')
			)
		),
		dueDate: v.optional(v.number()),
		priority: v.optional(
			v.union(v.literal('low'), v.literal('medium'), v.literal('high'))
		),
		categoryId: v.optional(v.id('categories')),
		tags: v.optional(v.array(v.string())),
		createdAt: v.number(),
		updatedAt: v.optional(v.number()),
		userId: v.id('users'),
		workspaceId: v.id('workspaces'),
	})
		.index('by_user_id', ['userId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_id_user_id', ['workspaceId', 'userId'])
		.index('by_category_id', ['categoryId']),

	mentions: defineTable({
		messageId: v.optional(v.id('messages')),
		mentionedMemberId: v.id('members'),
		mentionerMemberId: v.id('members'),
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		conversationId: v.optional(v.id('conversations')),
		parentMessageId: v.optional(v.id('messages')),
		cardId: v.optional(v.id('cards')),
		cardTitle: v.optional(v.string()),
		read: v.boolean(),
		createdAt: v.number(),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_mentioned_member_id', ['mentionedMemberId'])
		.index('by_mentioner_member_id', ['mentionerMemberId'])
		.index('by_message_id', ['messageId'])
		.index('by_card_id', ['cardId'])
		.index('by_workspace_id_mentioned_member_id', [
			'workspaceId',
			'mentionedMemberId',
		])
		.index('by_workspace_id_mentioned_member_id_read', [
			'workspaceId',
			'mentionedMemberId',
			'read',
		]),

	// Analytics tables
	userActivities: defineTable({
		memberId: v.id('members'),
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		activityType: v.string(), // 'page_view', 'message_sent', 'reaction_added', etc.
		duration: v.number(), // time spent in milliseconds
		metadata: v.object({
			path: v.optional(v.string()),
			referrer: v.optional(v.string()),
			details: v.optional(v.string()),
		}),
		timestamp: v.number(),
	})
		.index('by_member_id', ['memberId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_channel_id', ['channelId'])
		.index('by_activity_type', ['activityType'])
		.index('by_timestamp', ['timestamp']),

	channelSessions: defineTable({
		memberId: v.id('members'),
		workspaceId: v.id('workspaces'),
		channelId: v.id('channels'),
		startTime: v.number(),
		endTime: v.optional(v.number()),
		duration: v.number(), // in milliseconds
	})
		.index('by_member_id', ['memberId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_channel_id', ['channelId'])
		.index('by_start_time', ['startTime']),

	dailyStats: defineTable({
		workspaceId: v.id('workspaces'),
		channelId: v.optional(v.id('channels')),
		memberId: v.optional(v.id('members')),
		date: v.number(), // timestamp for the day (midnight)
		messageCount: v.number(),
		activeUserCount: v.number(),
		totalSessionDuration: v.number(), // in milliseconds
		avgSessionDuration: v.number(), // in milliseconds
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_channel_id', ['channelId'])
		.index('by_member_id', ['memberId'])
		.index('by_date', ['date'])
		.index('by_workspace_id_date', ['workspaceId', 'date']),

	directReads: defineTable({
		messageId: v.id('messages'),
		memberId: v.id('members'),
		timestamp: v.number(),
	})
		.index('by_message_id', ['messageId'])
		.index('by_member_id', ['memberId'])
		.index('by_message_id_member_id', ['messageId', 'memberId']),

	preferences: defineTable({
		userId: v.id('users'),
		lastActiveWorkspaceId: v.optional(v.id('workspaces')),
		lastActiveTimestamp: v.optional(v.number()),
		settings: v.optional(
			v.object({
				theme: v.optional(v.string()),
				statusTracking: v.optional(v.boolean()), // Enable/disable status tracking
				// Notification preferences
				notifications: v.optional(
					v.object({
						mentions: v.optional(v.boolean()), // Default: true
						assignee: v.optional(v.boolean()), // Default: true
						threadReply: v.optional(v.boolean()), // Default: true
						directMessage: v.optional(v.boolean()), // Default: true
						weeklyDigest: v.optional(v.boolean()), // Default: false
						weeklyDigestDay: v.optional(
							v.union(
								v.literal('monday'),
								v.literal('tuesday'),
								v.literal('wednesday'),
								v.literal('thursday'),
								v.literal('friday'),
								v.literal('saturday'),
								v.literal('sunday')
							)
						), // Default: 'monday'
					})
				),
			})
		),
		// Workspace-specific preferences stored as a record
		workspacePreferences: v.optional(
			v.record(
				v.string(), // workspaceId as string key
				v.object({
					// Sidebar preferences
					sidebarCollapsed: v.optional(v.boolean()),
					expandedSections: v.optional(v.record(v.string(), v.boolean())),

					// Dashboard widget preferences
					dashboardWidgets: v.optional(
						v.array(
							v.object({
								id: v.string(), // Widget type
								title: v.string(),
								description: v.string(),
								visible: v.boolean(),
								size: v.union(v.literal('small'), v.literal('medium'), v.literal('large')),
							})
						)
					),
				})
			)
		),
	}).index('by_user_id', ['userId']),

	notes: defineTable({
		title: v.string(),
		content: v.string(), // JSON stringified Quill Delta
		memberId: v.id('members'),
		workspaceId: v.id('workspaces'),
		channelId: v.id('channels'),
		coverImage: v.optional(v.id('_storage')),
		icon: v.optional(v.string()),
		tags: v.optional(v.array(v.string())), // Added from new schema
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_channel_id', ['channelId'])
		.index('by_member_id', ['memberId'])
		.index('by_workspace_id_channel_id', ['workspaceId', 'channelId']),

	chatHistory: defineTable({
		workspaceId: v.id('workspaces'),
		memberId: v.id('members'),
		messages: v.array(
			v.object({
				role: v.union(v.literal('user'), v.literal('assistant')),
				content: v.string(),
				timestamp: v.number(),
				sources: v.optional(
					v.array(
						v.object({
							id: v.string(),
							type: v.string(),
							text: v.string(),
						})
					)
				),
				actions: v.optional(
					v.array(
						v.object({
							label: v.string(),
							type: v.string(),
							url: v.string(),
							noteId: v.optional(v.string()),
							channelId: v.optional(v.string()),
						})
					)
				),
			})
		),
		updatedAt: v.number(),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_member_id', ['memberId'])
		.index('by_workspace_id_member_id', ['workspaceId', 'memberId']),

	// Composio v3 Auth Configs (formerly integrations)
	auth_configs: defineTable({
		workspaceId: v.id('workspaces'),
		toolkit: v.union(
			v.literal('github'),
			v.literal('gmail'),
			v.literal('slack'),
			v.literal('jira'),
			v.literal('notion'),
			v.literal('clickup')
		),
		name: v.string(), // Human-readable name
		type: v.union(
			v.literal('use_composio_managed_auth'),
			v.literal('use_custom_auth'),
			v.literal('service_connection'),
			v.literal('no_auth')
		),
		authScheme: v.optional(v.string()), // OAuth2, API_KEY, etc.
		composioAuthConfigId: v.string(), // Composio's auth config ID
		credentials: v.optional(v.any()), // Custom auth credentials
		isComposioManaged: v.boolean(), // Whether Composio manages auth
		isDisabled: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
		createdBy: v.id('members'),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_toolkit', ['workspaceId', 'toolkit']),

	// Composio v3 Connected Accounts
	connected_accounts: defineTable({
		workspaceId: v.id('workspaces'),
		authConfigId: v.id('auth_configs'),
		userId: v.string(), // User identifier for Composio
		composioAccountId: v.string(), // Composio's connected account ID
		toolkit: v.string(), // Toolkit name
		status: v.union(
			v.literal('ACTIVE'),
			v.literal('PENDING'),
			v.literal('EXPIRED'),
			v.literal('ERROR'),
			v.literal('DISABLED')
		),
		statusReason: v.optional(v.string()),
		metadata: v.optional(v.any()),
		testRequestEndpoint: v.optional(v.string()),
		isDisabled: v.boolean(),
		connectedAt: v.number(),
		lastUsed: v.optional(v.number()),
		connectedBy: v.id('members'),
	})
		.index('by_workspace_id', ['workspaceId'])
		.index('by_auth_config', ['authConfigId'])
		.index('by_user_id', ['userId']),

	// MCP Servers for AI Agents
	mcp_servers: defineTable({
		workspaceId: v.id('workspaces'),
		name: v.string(), // Server name
		composioServerId: v.string(), // Composio's MCP server ID
		toolkitConfigs: v.array(
			v.object({
				toolkit: v.string(),
				authConfigId: v.string(),
				allowedTools: v.array(v.string()),
			})
		),
		useComposioManagedAuth: v.boolean(),
		serverUrls: v.optional(v.any()), // Generated server URLs
		isActive: v.boolean(),
		createdAt: v.number(),
		updatedAt: v.number(),
		createdBy: v.id('members'),
	}).index('by_workspace_id', ['workspaceId']),

	// Thread titles for storing user-defined thread names
	threadTitles: defineTable({
		messageId: v.id('messages'), // Parent message ID of the thread
		title: v.string(), // User-defined thread title
		workspaceId: v.id('workspaces'),
		createdBy: v.id('members'),
		createdAt: v.number(),
		updatedAt: v.number(),
	})
		.index('by_message_id', ['messageId'])
		.index('by_workspace_id', ['workspaceId'])
		.index('by_workspace_id_message_id', ['workspaceId', 'messageId']),
});

export default schema;
