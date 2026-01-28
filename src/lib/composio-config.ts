import { Composio } from "@composio/core";
import { OpenAIProvider } from "@composio/openai";
import { logger } from "./logger";

// Type definitions for Composio tools
export interface ComposioTool {
	name?: string;
	description?: string;
	function?: {
		name: string;
		description?: string;
		parameters?: Record<string, unknown>;
	};
	toolkit?: string;
	app?: string;
	_originalName?: string;
	priority?: number;
}

export interface ComposioConnection {
	id: string;
	status:
		| "INITIALIZING"
		| "INITIATED"
		| "ACTIVE"
		| "FAILED"
		| "EXPIRED"
		| "INACTIVE"
		| string;
	toolkit?: {
		slug?: string;
	};
	appName?: string;
	createdAt: string;
}

export interface ToolFetchOptions {
	maxToolsPerApp?: number;
	priorityLevel?: number;
	keywords?: string[];
	useCache?: boolean;
}

export interface ProcessToolOptions {
	maxTools: number;
	priorityLevel: number;
	keywords: string[];
	dashboardTools: string[];
}

export interface ConnectedApp {
	app: AvailableApp;
	connected: boolean;
	connectionId?: string;
	entityId?: string;
}

// Available apps in your Composio setup
export const AVAILABLE_APPS = {
	GMAIL: "GMAIL",
	GITHUB: "GITHUB",
	SLACK: "SLACK",
	NOTION: "NOTION",
	CLICKUP: "CLICKUP",
	LINEAR: "LINEAR",
} as const;

export type AvailableApp = (typeof AVAILABLE_APPS)[keyof typeof AVAILABLE_APPS];

// Dashboard tool definitions - these are the exact tools available on the Composio dashboard
const DASHBOARD_TOOLS = {
	GITHUB: [
		"GITHUB_ADD_AN_EMAIL_ADDRESS_FOR_THE_AUTHENTICATED_USER",
		"GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE",
		"GITHUB_ADD_A_REPOSITORY_COLLABORATOR",
		"GITHUB_ADD_LABELS_TO_AN_ISSUE",
		"GITHUB_APPROVE_A_WORKFLOW_RUN_FOR_A_FORK_PULL_REQUEST",
		"GITHUB_CANCEL_A_WORKFLOW_RUN",
		"GITHUB_COMPARE_TWO_COMMITS",
		"GITHUB_CREATE_AN_ISSUE",
		"GITHUB_CREATE_AN_ISSUE_COMMENT",
		"GITHUB_CREATE_AN_ORGANIZATION_REPOSITORY",
		"GITHUB_CREATE_A_BLOB",
		"GITHUB_CREATE_A_COMMIT",
		"GITHUB_CREATE_A_PULL_REQUEST",
		"GITHUB_CREATE_A_REFERENCE",
		"GITHUB_CREATE_A_RELEASE",
		"GITHUB_CREATE_A_TREE",
		"GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS",
		"GITHUB_DELETE_A_REPOSITORY",
		"GITHUB_DELETE_EMAIL_ADDRESS_FOR_THE_AUTHENTICATED_USER",
		"GITHUB_DELETE_PULL_REQUEST_REVIEW_COMMENT",
		"GITHUB_DELETE_REPOSITORY_SUBSCRIPTION",
		"GITHUB_GET_A_COMMIT",
		"GITHUB_GET_A_PULL_REQUEST",
		"GITHUB_GET_A_REPOSITORY",
		"GITHUB_GET_AN_ISSUE",
		"GITHUB_GET_AUTHENTICATED_USER",
		"GITHUB_LEAVE_A_TEAM_DISCUSSION",
		"GITHUB_LIST_ALL_BRANCHES_FOR_THE_HEAD_COMMIT",
		"GITHUB_LIST_EMAIL_ADDRESSES_FOR_THE_AUTHENTICATED_USER",
		"GITHUB_LIST_ISSUES_ASSIGNED_TO_THE_AUTHENTICATED_USER",
		"GITHUB_LIST_PULL_REQUESTS",
		"GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER",
		"GITHUB_MOVE_A_PROJECT_CARD",
		"GITHUB_PING_A_HOOK",
		"GITHUB_UPDATE_AN_ISSUE",
		"GITHUB_UPDATE_A_PULL_REQUEST",
	],
	GMAIL: [
		"GMAIL_SEND_EMAIL",
		"GMAIL_GET_THREADS",
		"GMAIL_GET_THREAD",
		"GMAIL_GET_MESSAGES",
		"GMAIL_GET_MESSAGE",
		"GMAIL_GET_LABELS",
		"GMAIL_CREATE_LABEL",
		"GMAIL_UPDATE_LABEL",
		"GMAIL_DELETE_LABEL",
		"GMAIL_SEARCH_EMAILS",
		"GMAIL_MARK_AS_READ",
		"GMAIL_MARK_AS_UNREAD",
		"GMAIL_ADD_LABEL_TO_EMAIL",
		"GMAIL_REMOVE_LABEL_FROM_EMAIL",
		"GMAIL_CREATE_DRAFT",
		"GMAIL_UPDATE_DRAFT",
		"GMAIL_DELETE_DRAFT",
		"GMAIL_SEND_DRAFT",
		"GMAIL_GET_USER_PROFILE",
		"GMAIL_DELETE_MESSAGE",
		"GMAIL_GET_ATTACHMENT",
		"GMAIL_REPLY_TO_EMAIL",
		"GMAIL_FORWARD_EMAIL",
	],
	SLACK: [
		"SLACK_ADD_A_CUSTOM_EMOJI_TO_A_SLACK_TEAM",
		"SLACK_ADD_AN_EMOJI_ALIAS_IN_SLACK",
		"SLACK_ADD_A_REMOTE_FILE_FROM_A_SERVICE",
		"SLACK_ADD_A_STAR_TO_AN_ITEM",
		"SLACK_ADD_CALL_PARTICIPANTS",
		"SLACK_ADD_EMOJI",
		"SLACK_ADD_REACTION_TO_AN_ITEM",
		"SLACK_ARCHIVE_A_PUBLIC_OR_PRIVATE_CHANNEL",
		"SLACK_ARCHIVE_A_SLACK_CONVERSATION",
		"SLACK_CLEAR_STATUS",
		"SLACK_CLOSE_DM_OR_MULTI_PERSON_DM",
		"SLACK_CREATE_A_REMINDER",
		"SLACK_CREATE_A_SLACK_USER_GROUP",
		"SLACK_CREATE_CANVAS",
		"SLACK_CREATE_CHANNEL",
		"SLACK_CREATE_CHANNEL_BASED_CONVERSATION",
		"SLACK_CUSTOMIZE_URL_UNFURL",
		"SLACK_CUSTOMIZE_URL_UNFURLING_IN_MESSAGES",
		"SLACK_DELETE_A_COMMENT_ON_A_FILE",
		"SLACK_DELETE_A_FILE_BY_ID",
		"SLACK_DELETE_A_PUBLIC_OR_PRIVATE_CHANNEL",
		"SLACK_DELETE_A_SCHEDULED_MESSAGE_IN_A_CHAT",
		"SLACK_DELETE_A_SLACK_REMINDER",
		"SLACK_DELETE_CANVAS",
		"SLACK_DELETES_A_MESSAGE_FROM_A_CHAT",
		"SLACK_DELETE_USER_PROFILE_PHOTO",
		"SLACK_DISABLE_AN_EXISTING_SLACK_USER_GROUP",
		"SLACK_EDIT_CANVAS",
		"SLACK_ENABLE_A_SPECIFIED_USER_GROUP",
		"SLACK_ENABLE_PUBLIC_SHARING_OF_A_FILE",
		"SLACK_END_A_CALL_WITH_DURATION_AND_ID",
		"SLACK_END_SNOOZE",
		"SLACK_END_USER_DO_NOT_DISTURB_SESSION",
		"SLACK_END_USER_SNOOZE_MODE_IMMEDIATELY",
		"SLACK_FETCH_BOT_USER_INFORMATION",
		"SLACK_FETCH_CONVERSATION_HISTORY",
		"SLACK_FETCH_DND_STATUS_FOR_MULTIPLE_TEAM_MEMBERS",
		"SLACK_FETCH_ITEM_REACTIONS",
		"SLACK_FETCH_MESSAGE_THREAD_FROM_A_CONVERSATION",
		"SLACK_FETCH_TEAM_INFO",
		"SLACK_FETCH_WORKSPACE_SETTINGS_INFORMATION",
		"SLACK_FIND_CHANNELS",
		"SLACK_FIND_USER_BY_EMAIL_ADDRESS",
		"SLACK_FIND_USERS",
		"SLACK_GET_CANVAS",
		"SLACK_GET_CHANNEL_CONVERSATION_PREFERENCES",
		"SLACK_GET_REMINDER_INFORMATION",
		"SLACK_GET_REMOTE_FILE",
		"SLACK_GET_TEAM_DND_STATUS",
		"SLACK_GET_USER_PRESENCE_INFO",
		"SLACK_INVITE_USERS_TO_A_SLACK_CHANNEL",
		"SLACK_INVITE_USER_TO_CHANNEL",
		"SLACK_INVITE_USER_TO_WORKSPACE",
		"SLACK_JOIN_AN_EXISTING_CONVERSATION",
		"SLACK_LEAVE_A_CONVERSATION",
		"SLACK_LIST_ALL_CHANNELS",
		"SLACK_LIST_ALL_USERS",
		"SLACK_LIST_ALL_USERS_IN_A_USER_GROUP",
		"SLACK_LIST_CANVASES",
		"SLACK_LIST_CONVERSATIONS",
		"SLACK_LIST_FILES_WITH_FILTERS_IN_SLACK",
		"SLACK_LIST_REMINDERS",
		"SLACK_LIST_REMOTE_FILES",
		"SLACK_LIST_SCHEDULED_MESSAGES",
		"SLACK_LIST_SCHEDULED_MESSAGES_IN_A_CHANNEL",
		"SLACK_LIST_SLACK_S_REMOTE_FILES_WITH_FILTERS",
		"SLACK_LISTS_PINNED_ITEMS_IN_A_CHANNEL",
		"SLACK_LIST_STARRED_ITEMS",
		"SLACK_LISTS_USER_S_STARRED_ITEMS_WITH_PAGINATION",
		"SLACK_LIST_TEAM_CUSTOM_EMOJIS",
		"SLACK_LIST_USER_GROUPS_FOR_TEAM_WITH_OPTIONS",
		"SLACK_LIST_USER_REACTIONS",
		"SLACK_LIST_USER_REMINDERS_WITH_DETAILS",
		"SLACK_LIST_WORKSPACE_USERS",
		"SLACK_LOOKUP_CANVAS_SECTIONS",
		"SLACK_MANUALLY_SET_USER_PRESENCE",
		"SLACK_MARK_REMINDER_AS_COMPLETE",
		"SLACK_OPEN_DM",
		"SLACK_PINS_AN_ITEM_TO_A_CHANNEL",
		"SLACK_REGISTER_CALL_PARTICIPANTS_REMOVAL",
		"SLACK_REGISTERS_A_NEW_CALL_WITH_PARTICIPANTS",
		"SLACK_REGISTERS_NEW_CALL_PARTICIPANTS",
		"SLACK_REMOVE_A_REMOTE_FILE",
		"SLACK_REMOVE_A_STAR_FROM_AN_ITEM",
		"SLACK_REMOVE_A_USER_FROM_A_CONVERSATION",
		"SLACK_REMOVE_CALL_PARTICIPANTS",
		"SLACK_REMOVE_REACTION_FROM_ITEM",
		"SLACK_RENAME_A_CONVERSATION",
		"SLACK_RENAME_AN_EMOJI",
		"SLACK_RENAME_A_SLACK_CHANNEL",
		"SLACK_RETRIEVE_A_USER_S_IDENTITY_DETAILS",
		"SLACK_RETRIEVE_CALL_INFORMATION",
		"SLACK_RETRIEVE_CONVERSATION_INFORMATION",
		"SLACK_RETRIEVE_CONVERSATION_MEMBERS_LIST",
		"SLACK_RETRIEVE_CURRENT_USER_DND_STATUS",
		"SLACK_RETRIEVE_DETAILED_INFORMATION_ABOUT_A_FILE",
		"SLACK_RETRIEVE_DETAILED_USER_INFORMATION",
		"SLACK_RETRIEVE_MESSAGE_PERMALINK_URL",
		"SLACK_RETRIEVE_REMOTE_FILE_INFO_IN_SLACK",
		"SLACK_RETRIEVE_TEAM_PROFILE_DETAILS",
		"SLACK_RETRIEVE_USER_PROFILE_INFORMATION",
		"SLACK_REVERSE_A_CONVERSATION_S_ARCHIVAL_STATUS",
		"SLACK_REVOKE_PUBLIC_SHARING_ACCESS_FOR_A_FILE",
		"SLACK_SCHEDULE_MESSAGE",
		"SLACK_SEARCH_ALL",
		"SLACK_SEARCH_MESSAGES",
		"SLACK_SEND_EPHEMERAL_MESSAGE",
		"SLACK_SEND_MESSAGE",
		"SLACK_SENDS_EPHEMERAL_MESSAGES_TO_CHANNEL_USERS",
		"SLACK_SET_A_CONVERSATION_S_PURPOSE",
		"SLACK_SET_DND_DURATION",
		"SLACK_SET_PROFILE_PHOTO",
		"SLACK_SET_READ_CURSOR_IN_A_CONVERSATION",
		"SLACK_SET_SLACK_USER_PROFILE_INFORMATION",
		"SLACK_SET_STATUS",
		"SLACK_SET_THE_TOPIC_OF_A_CONVERSATION",
		"SLACK_SET_USER_PROFILE_PHOTO_WITH_CROPPING_OPTIONS",
		"SLACK_SHARE_A_ME_MESSAGE_IN_A_CHANNEL",
		"SLACK_SHARE_REMOTE_FILE_IN_CHANNELS",
		"SLACK_START_CALL",
		"SLACK_START_REAL_TIME_MESSAGING_SESSION",
		"SLACK_UNARCHIVE_A_PUBLIC_OR_PRIVATE_CHANNEL",
		"SLACK_UNARCHIVE_CHANNEL",
		"SLACK_UNPIN_ITEM_FROM_CHANNEL",
		"SLACK_UPDATE_AN_EXISTING_SLACK_USER_GROUP",
		"SLACK_UPDATES_AN_EXISTING_REMOTE_FILE",
		"SLACK_UPDATES_A_SLACK_MESSAGE",
		"SLACK_UPDATE_SLACK_CALL_INFORMATION",
		"SLACK_UPDATE_USER_GROUP_MEMBERS",
		"SLACK_UPLOAD_OR_CREATE_A_FILE_IN_SLACK",
	],
	NOTION: [
		"NOTION_ADD_MULTIPLE_PAGE_CONTENT",
		"NOTION_ADD_PAGE_CONTENT",
		"NOTION_APPEND_BLOCK_CHILDREN",
		"NOTION_APPEND_CODE_BLOCKS",
		"NOTION_APPEND_LAYOUT_BLOCKS",
		"NOTION_APPEND_MEDIA_BLOCKS",
		"NOTION_APPEND_TABLE_BLOCKS",
		"NOTION_APPEND_TASK_BLOCKS",
		"NOTION_APPEND_TEXT_BLOCKS",
		"NOTION_ARCHIVE_NOTION_PAGE",
		"NOTION_CREATE_COMMENT",
		"NOTION_CREATE_DATABASE",
		"NOTION_CREATE_FILE_UPLOAD",
		"NOTION_CREATE_NOTION_PAGE",
		"NOTION_DELETE_BLOCK",
		"NOTION_DUPLICATE_PAGE",
		"NOTION_FETCH_ALL_BLOCK_CONTENTS",
		"NOTION_FETCH_BLOCK_CONTENTS",
		"NOTION_FETCH_BLOCK_METADATA",
		"NOTION_FETCH_COMMENTS",
		"NOTION_FETCH_DATA",
		"NOTION_FETCH_DATABASE",
		"NOTION_FETCH_ROW",
		"NOTION_GET_ABOUT_ME",
		"NOTION_GET_ABOUT_USER",
		"NOTION_GET_PAGE_PROPERTY_ACTION",
		"NOTION_INSERT_ROW_DATABASE",
		"NOTION_LIST_DATA_SOURCE_TEMPLATES",
		"NOTION_LIST_FILE_UPLOADS",
		"NOTION_LIST_USERS",
		"NOTION_QUERY_DATABASE",
		"NOTION_QUERY_DATABASE_WITH_FILTER",
		"NOTION_QUERY_DATA_SOURCE",
		"NOTION_RETRIEVE_COMMENT",
		"NOTION_RETRIEVE_DATABASE_PROPERTY",
		"NOTION_RETRIEVE_FILE_UPLOAD",
		"NOTION_SEARCH_NOTION_PAGE",
		"NOTION_SEND_FILE_UPLOAD",
		"NOTION_UPDATE_BLOCK",
		"NOTION_UPDATE_PAGE",
		"NOTION_UPDATE_ROW_DATABASE",
		"NOTION_UPDATE_SCHEMA_DATABASE",
	],
	CLICKUP: [
		"CLICKUP_ADD_DEPENDENCY",
		"CLICKUP_ADD_GUEST_TO_FOLDER",
		"CLICKUP_ADD_GUEST_TO_LIST",
		"CLICKUP_ADD_GUEST_TO_TASK",
		"CLICKUP_ADD_TAGS_FROM_TIME_ENTRIES",
		"CLICKUP_ADD_TAG_TO_TASK",
		"CLICKUP_ADD_TASK_LINK",
		"CLICKUP_ADD_TASK_TO_LIST",
		"CLICKUP_ATTACHMENTS_UPLOAD_FILE_TO_TASK_AS_ATTACHMENT",
		"CLICKUP_AUTHORIZATION_GET_ACCESS_TOKEN",
		"CLICKUP_AUTHORIZATION_GET_WORK_SPACE_LIST",
		"CLICKUP_AUTHORIZATION_VIEW_ACCOUNT_DETAILS",
		"CLICKUP_CHANGE_TAG_NAMES_FROM_TIME_ENTRIES",
		"CLICKUP_CLICK_UP_SEARCH_DOCS",
		"CLICKUP_CREATE_A_TIME_ENTRY",
		"CLICKUP_CREATE_CHAT_VIEW_COMMENT",
		"CLICKUP_CREATE_CHECKLIST",
		"CLICKUP_CREATE_CHECKLIST_ITEM",
		"CLICKUP_CREATE_FOLDER",
		"CLICKUP_CREATE_FOLDERLESS_LIST",
		"CLICKUP_CREATE_FOLDER_VIEW",
		"CLICKUP_CREATE_GOAL",
		"CLICKUP_CREATE_KEY_RESULT",
		"CLICKUP_CREATE_LIST",
		"CLICKUP_CREATE_LIST_COMMENT",
		"CLICKUP_CREATE_LIST_VIEW",
		"CLICKUP_CREATE_SPACE",
		"CLICKUP_CREATE_SPACE_TAG",
		"CLICKUP_CREATE_SPACE_VIEW",
		"CLICKUP_CREATE_TASK",
		"CLICKUP_CREATE_TASK_ATTACHMENT",
		"CLICKUP_CREATE_TASK_COMMENT",
		"CLICKUP_CREATE_TASK_FROM_TEMPLATE",
		"CLICKUP_CREATE_TEAM",
		"CLICKUP_CREATE_WEBHOOK",
		"CLICKUP_CREATE_WORKSPACE_EVERYTHING_LEVEL_VIEW",
		"CLICKUP_DELETE_A_TIME_ENTRY",
		"CLICKUP_DELETE_CHECKLIST",
		"CLICKUP_DELETE_CHECKLIST_ITEM",
		"CLICKUP_DELETE_COMMENT",
		"CLICKUP_DELETE_DEPENDENCY",
		"CLICKUP_DELETE_FOLDER",
		"CLICKUP_DELETE_GOAL",
		"CLICKUP_DELETE_KEY_RESULT",
		"CLICKUP_DELETE_LIST",
		"CLICKUP_DELETE_SPACE",
		"CLICKUP_DELETE_SPACE_TAG",
		"CLICKUP_DELETE_TASK",
		"CLICKUP_DELETE_TASK_LINK",
		"CLICKUP_DELETE_TEAM",
		"CLICKUP_DELETE_TIME_TRACKED",
		"CLICKUP_DELETE_VIEW",
		"CLICKUP_DELETE_WEBHOOK",
		"CLICKUP_EDIT_CHECKLIST",
		"CLICKUP_EDIT_CHECKLIST_ITEM",
		"CLICKUP_EDIT_GUEST_ON_WORKSPACE",
		"CLICKUP_EDIT_KEY_RESULT",
		"CLICKUP_EDIT_SPACE_TAG",
		"CLICKUP_EDIT_TIME_TRACKED",
		"CLICKUP_EDIT_USER_ON_WORKSPACE",
		"CLICKUP_FOLDERS_CREATE_NEW_FOLDER",
		"CLICKUP_FOLDERS_GET_CONTENTS_OF",
		"CLICKUP_FOLDERS_GET_FOLDER_CONTENT",
		"CLICKUP_GET_ACCESSIBLE_CUSTOM_FIELDS",
		"CLICKUP_GET_ACCESS_TOKEN",
		"CLICKUP_GET_ALL_TAGS_FROM_TIME_ENTRIES",
		"CLICKUP_GET_AUTHORIZED_TEAMS_WORKSPACES",
		"CLICKUP_GET_AUTHORIZED_USER",
		"CLICKUP_GET_BULK_TASKS_TIME_IN_STATUS",
		"CLICKUP_GET_CHAT_VIEW_COMMENTS",
		"CLICKUP_GET_CUSTOM_ROLES",
		"CLICKUP_GET_CUSTOM_TASK_TYPES",
		"CLICKUP_GET_FILTERED_TEAM_TASKS",
		"CLICKUP_GET_FOLDER",
		"CLICKUP_GET_FOLDERLESS_LISTS",
		"CLICKUP_GET_FOLDERS",
		"CLICKUP_GET_FOLDER_VIEWS",
		"CLICKUP_GET_GOAL",
		"CLICKUP_GET_GOALS",
		"CLICKUP_GET_GUEST",
		"CLICKUP_GET_LIST",
		"CLICKUP_GET_LIST_COMMENTS",
		"CLICKUP_GET_LIST_MEMBERS",
		"CLICKUP_GET_LISTS",
		"CLICKUP_GET_LIST_VIEWS",
		"CLICKUP_GET_RUNNING_TIME_ENTRY",
		"CLICKUP_GET_SINGULAR_TIME_ENTRY",
		"CLICKUP_GET_SPACE",
		"CLICKUP_GET_SPACES",
		"CLICKUP_GET_SPACE_TAGS",
		"CLICKUP_GET_SPACE_VIEWS",
		"CLICKUP_GET_TASK",
		"CLICKUP_GET_TASK_COMMENTS",
		"CLICKUP_GET_TASK_MEMBERS",
		"CLICKUP_GET_TASKS",
		"CLICKUP_GET_TASK_S_TIME_IN_STATUS",
		"CLICKUP_GET_TASK_TEMPLATES",
		"CLICKUP_GET_TEAMS",
		"CLICKUP_GET_TIME_ENTRIES_WITHIN_A_DATE_RANGE",
		"CLICKUP_GET_TIME_ENTRY_HISTORY",
		"CLICKUP_GET_TRACKED_TIME",
		"CLICKUP_GET_USER",
		"CLICKUP_GET_VIEW",
		"CLICKUP_GET_VIEW_TASKS",
		"CLICKUP_GET_WEBHOOKS",
		"CLICKUP_GET_WORKSPACE_EVERYTHING_LEVEL_VIEWS",
		"CLICKUP_GET_WORKSPACE_PLAN",
		"CLICKUP_GET_WORKSPACE_SEATS",
		"CLICKUP_INVITE_GUEST_TO_WORKSPACE",
		"CLICKUP_INVITE_USER_TO_WORKSPACE",
		"CLICKUP_LISTS_GET_FOLDER_LISTS",
		"CLICKUP_MEMBERS_GET_LIST_USERS",
		"CLICKUP_REMOVE_CUSTOM_FIELD_VALUE",
		"CLICKUP_REMOVE_GUEST_FROM_FOLDER",
		"CLICKUP_REMOVE_GUEST_FROM_LIST",
		"CLICKUP_REMOVE_GUEST_FROM_TASK",
		"CLICKUP_REMOVE_GUEST_FROM_WORKSPACE",
		"CLICKUP_REMOVE_TAG_FROM_TASK",
		"CLICKUP_REMOVE_TAGS_FROM_TIME_ENTRIES",
		"CLICKUP_REMOVE_TASK_FROM_LIST",
		"CLICKUP_REMOVE_USER_FROM_WORKSPACE",
		"CLICKUP_SET_CUSTOM_FIELD_VALUE",
		"CLICKUP_SHARED_HIERARCHY",
		"CLICKUP_SPACES_GET_DETAILS",
		"CLICKUP_SPACES_GET_SPACE_DETAILS",
		"CLICKUP_START_A_TIME_ENTRY",
		"CLICKUP_STOP_A_TIME_ENTRY",
		"CLICKUP_TASK_CHECKLISTS_CREATE_NEW_CHECKLIST",
		"CLICKUP_TASKS_GET_TASK_DETAILS",
		"CLICKUP_TEAMS_USER_GROUPS_CREATE_TEAM",
		"CLICKUP_TEAMS_WORK_SPACES_GET_WORK_SPACE_PLAN",
		"CLICKUP_TEAMS_WORK_SPACES_GET_WORK_SPACE_SEATS",
		"CLICKUP_TRACK_TIME",
		"CLICKUP_UPDATE_A_TIME_ENTRY",
		"CLICKUP_UPDATE_COMMENT",
		"CLICKUP_UPDATE_FOLDER",
		"CLICKUP_UPDATE_GOAL",
		"CLICKUP_UPDATE_LIST",
		"CLICKUP_UPDATE_SPACE",
		"CLICKUP_UPDATE_TASK",
		"CLICKUP_UPDATE_TEAM",
		"CLICKUP_UPDATE_VIEW",
		"CLICKUP_UPDATE_WEBHOOK",
		"CLICKUP_VIEWS_GET_EVERYTHING_LEVEL",
		"CLICKUP_VIEWS_SPACE_VIEWS_GET",
	],
	LINEAR: [
		"LINEAR_CREATE_COMMENT_REACTION",
		"LINEAR_CREATE_LINEAR_ATTACHMENT",
		"LINEAR_CREATE_LINEAR_COMMENT",
		"LINEAR_CREATE_LINEAR_ISSUE",
		"LINEAR_CREATE_LINEAR_ISSUE_DETAILS",
		"LINEAR_CREATE_LINEAR_LABEL",
		"LINEAR_CREATE_LINEAR_PROJECT",
		"LINEAR_DELETE_LINEAR_ISSUE",
		"LINEAR_GET_ALL_LINEAR_TEAMS",
		"LINEAR_GET_ATTACHMENTS",
		"LINEAR_GET_CURRENT_USER",
		"LINEAR_GET_CYCLES_BY_TEAM_ID",
		"LINEAR_GET_LINEAR_ISSUE",
		"LINEAR_GET_LINEAR_PROJECT",
		"LINEAR_LIST_ISSUE_DRAFTS",
		"LINEAR_LIST_ISSUES_BY_TEAM_ID",
		"LINEAR_LIST_LINEAR_CYCLES",
		"LINEAR_LIST_LINEAR_ISSUES",
		"LINEAR_LIST_LINEAR_LABELS",
		"LINEAR_LIST_LINEAR_PROJECTS",
		"LINEAR_LIST_LINEAR_STATES",
		"LINEAR_LIST_LINEAR_TEAMS",
		"LINEAR_LIST_LINEAR_USERS",
		"LINEAR_MANAGE_DRAFT",
		"LINEAR_REMOVE_ISSUE_LABEL",
		"LINEAR_REMOVE_REACTION",
		"LINEAR_RUN_QUERY_OR_MUTATION",
		"LINEAR_UPDATE_ISSUE",
		"LINEAR_UPDATE_LINEAR_PROJECT",
	],
} as const;

// Tool priority levels for smart filtering
const TOOL_PRIORITIES = {
	HIGH: 1,
	MEDIUM: 2,
	LOW: 3,
} as const;

// Priority mapping for tools based on common use cases
const TOOL_PRIORITY_MAP: Record<string, number> = {
	// High priority GitHub tools (repository and issue management)
	GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: TOOL_PRIORITIES.HIGH,
	GITHUB_GET_A_REPOSITORY: TOOL_PRIORITIES.HIGH,
	GITHUB_CREATE_AN_ISSUE: TOOL_PRIORITIES.HIGH,
	GITHUB_GET_AN_ISSUE: TOOL_PRIORITIES.HIGH,
	GITHUB_UPDATE_AN_ISSUE: TOOL_PRIORITIES.HIGH,
	GITHUB_CREATE_A_PULL_REQUEST: TOOL_PRIORITIES.HIGH,
	GITHUB_GET_A_PULL_REQUEST: TOOL_PRIORITIES.HIGH,
	GITHUB_LIST_PULL_REQUESTS: TOOL_PRIORITIES.HIGH,
	GITHUB_CREATE_OR_UPDATE_FILE_CONTENTS: TOOL_PRIORITIES.HIGH,
	GITHUB_GET_AUTHENTICATED_USER: TOOL_PRIORITIES.HIGH,

	// High priority Gmail tools (core email functions)
	GMAIL_SEND_EMAIL: TOOL_PRIORITIES.HIGH,
	GMAIL_GET_MESSAGES: TOOL_PRIORITIES.HIGH,
	GMAIL_SEARCH_EMAILS: TOOL_PRIORITIES.HIGH,
	GMAIL_REPLY_TO_EMAIL: TOOL_PRIORITIES.HIGH,
	GMAIL_CREATE_DRAFT: TOOL_PRIORITIES.HIGH,
	GMAIL_GET_USER_PROFILE: TOOL_PRIORITIES.HIGH,

	// High priority Slack tools (core messaging and channel functions)
	SLACK_SEND_MESSAGE: TOOL_PRIORITIES.HIGH,
	SLACK_LIST_CONVERSATIONS: TOOL_PRIORITIES.HIGH,
	SLACK_LIST_ALL_CHANNELS: TOOL_PRIORITIES.HIGH,
	SLACK_CREATE_CHANNEL: TOOL_PRIORITIES.HIGH,
	SLACK_FETCH_CONVERSATION_HISTORY: TOOL_PRIORITIES.HIGH,
	SLACK_SEARCH_MESSAGES: TOOL_PRIORITIES.HIGH,
	SLACK_RETRIEVE_DETAILED_USER_INFORMATION: TOOL_PRIORITIES.HIGH,
	SLACK_LIST_ALL_USERS: TOOL_PRIORITIES.HIGH,
	SLACK_FIND_CHANNELS: TOOL_PRIORITIES.HIGH,
	SLACK_FIND_USERS: TOOL_PRIORITIES.HIGH,
	SLACK_INVITE_USER_TO_CHANNEL: TOOL_PRIORITIES.HIGH,
	SLACK_OPEN_DM: TOOL_PRIORITIES.HIGH,

	// High priority Notion tools (core page and database functions)
	NOTION_CREATE_NOTION_PAGE: TOOL_PRIORITIES.HIGH,
	NOTION_SEARCH_NOTION_PAGE: TOOL_PRIORITIES.HIGH,
	NOTION_UPDATE_PAGE: TOOL_PRIORITIES.HIGH,
	NOTION_CREATE_DATABASE: TOOL_PRIORITIES.HIGH,
	NOTION_QUERY_DATABASE: TOOL_PRIORITIES.HIGH,
	NOTION_FETCH_DATABASE: TOOL_PRIORITIES.HIGH,
	NOTION_INSERT_ROW_DATABASE: TOOL_PRIORITIES.HIGH,
	NOTION_UPDATE_ROW_DATABASE: TOOL_PRIORITIES.HIGH,
	NOTION_ADD_PAGE_CONTENT: TOOL_PRIORITIES.HIGH,
	NOTION_APPEND_TEXT_BLOCKS: TOOL_PRIORITIES.HIGH,
	NOTION_FETCH_BLOCK_CONTENTS: TOOL_PRIORITIES.HIGH,
	NOTION_LIST_USERS: TOOL_PRIORITIES.HIGH,

	// High priority ClickUp tools (core task and project management)
	CLICKUP_CREATE_TASK: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_TASK: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_TASKS: TOOL_PRIORITIES.HIGH,
	CLICKUP_UPDATE_TASK: TOOL_PRIORITIES.HIGH,
	CLICKUP_CREATE_LIST: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_LIST: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_LISTS: TOOL_PRIORITIES.HIGH,
	CLICKUP_CREATE_SPACE: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_SPACES: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_FILTERED_TEAM_TASKS: TOOL_PRIORITIES.HIGH,
	CLICKUP_CREATE_FOLDER: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_FOLDERS: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_AUTHORIZED_USER: TOOL_PRIORITIES.HIGH,
	CLICKUP_TRACK_TIME: TOOL_PRIORITIES.HIGH,
	CLICKUP_CREATE_GOAL: TOOL_PRIORITIES.HIGH,
	CLICKUP_GET_GOALS: TOOL_PRIORITIES.HIGH,

	// High priority Linear tools (core issue tracking and project management)
	LINEAR_CREATE_LINEAR_ISSUE: TOOL_PRIORITIES.HIGH,
	LINEAR_GET_LINEAR_ISSUE: TOOL_PRIORITIES.HIGH,
	LINEAR_LIST_LINEAR_ISSUES: TOOL_PRIORITIES.HIGH,
	LINEAR_UPDATE_ISSUE: TOOL_PRIORITIES.HIGH,
	LINEAR_CREATE_LINEAR_PROJECT: TOOL_PRIORITIES.HIGH,
	LINEAR_GET_LINEAR_PROJECT: TOOL_PRIORITIES.HIGH,
	LINEAR_LIST_LINEAR_PROJECTS: TOOL_PRIORITIES.HIGH,
	LINEAR_GET_ALL_LINEAR_TEAMS: TOOL_PRIORITIES.HIGH,
	LINEAR_LIST_LINEAR_TEAMS: TOOL_PRIORITIES.HIGH,
	LINEAR_GET_CURRENT_USER: TOOL_PRIORITIES.HIGH,
	LINEAR_LIST_LINEAR_STATES: TOOL_PRIORITIES.HIGH,
	LINEAR_LIST_LINEAR_LABELS: TOOL_PRIORITIES.HIGH,

	// Medium priority tools
	GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE: TOOL_PRIORITIES.MEDIUM,
	GITHUB_ADD_LABELS_TO_AN_ISSUE: TOOL_PRIORITIES.MEDIUM,
	GITHUB_CREATE_AN_ISSUE_COMMENT: TOOL_PRIORITIES.MEDIUM,
	GMAIL_GET_LABELS: TOOL_PRIORITIES.MEDIUM,
	GMAIL_MARK_AS_READ: TOOL_PRIORITIES.MEDIUM,
	GMAIL_FORWARD_EMAIL: TOOL_PRIORITIES.MEDIUM,
	SLACK_ADD_REACTION_TO_AN_ITEM: TOOL_PRIORITIES.MEDIUM,
	SLACK_CREATE_A_REMINDER: TOOL_PRIORITIES.MEDIUM,
	SLACK_SCHEDULE_MESSAGE: TOOL_PRIORITIES.MEDIUM,
	SLACK_ARCHIVE_A_PUBLIC_OR_PRIVATE_CHANNEL: TOOL_PRIORITIES.MEDIUM,
	SLACK_RETRIEVE_CONVERSATION_INFORMATION: TOOL_PRIORITIES.MEDIUM,
	SLACK_SET_STATUS: TOOL_PRIORITIES.MEDIUM,
	SLACK_PINS_AN_ITEM_TO_A_CHANNEL: TOOL_PRIORITIES.MEDIUM,
	NOTION_CREATE_COMMENT: TOOL_PRIORITIES.MEDIUM,
	NOTION_ARCHIVE_NOTION_PAGE: TOOL_PRIORITIES.MEDIUM,
	NOTION_DUPLICATE_PAGE: TOOL_PRIORITIES.MEDIUM,
	NOTION_APPEND_CODE_BLOCKS: TOOL_PRIORITIES.MEDIUM,
	NOTION_APPEND_TABLE_BLOCKS: TOOL_PRIORITIES.MEDIUM,
	NOTION_APPEND_TASK_BLOCKS: TOOL_PRIORITIES.MEDIUM,
	NOTION_UPDATE_BLOCK: TOOL_PRIORITIES.MEDIUM,
	NOTION_DELETE_BLOCK: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_ADD_TAG_TO_TASK: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_CREATE_CHECKLIST: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_CREATE_TASK_COMMENT: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_CREATE_TASK_ATTACHMENT: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_ADD_DEPENDENCY: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_UPDATE_LIST: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_UPDATE_FOLDER: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_GET_TIME_ENTRIES_WITHIN_A_DATE_RANGE: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_START_A_TIME_ENTRY: TOOL_PRIORITIES.MEDIUM,
	CLICKUP_STOP_A_TIME_ENTRY: TOOL_PRIORITIES.MEDIUM,
	LINEAR_CREATE_LINEAR_COMMENT: TOOL_PRIORITIES.MEDIUM,
	LINEAR_CREATE_LINEAR_ATTACHMENT: TOOL_PRIORITIES.MEDIUM,
	LINEAR_CREATE_COMMENT_REACTION: TOOL_PRIORITIES.MEDIUM,
	LINEAR_CREATE_LINEAR_LABEL: TOOL_PRIORITIES.MEDIUM,
	LINEAR_LIST_ISSUES_BY_TEAM_ID: TOOL_PRIORITIES.MEDIUM,
	LINEAR_GET_CYCLES_BY_TEAM_ID: TOOL_PRIORITIES.MEDIUM,
	LINEAR_DELETE_LINEAR_ISSUE: TOOL_PRIORITIES.MEDIUM,
	LINEAR_REMOVE_ISSUE_LABEL: TOOL_PRIORITIES.MEDIUM,
};

// App configurations with descriptions and use cases
export const APP_CONFIGS = {
	GMAIL: {
		name: "Gmail",
		description: "Send emails, read inbox, manage drafts and labels",
		toolCategories: ["email", "communication"],
		commonActions: [
			"send_email",
			"read_emails",
			"search_emails",
			"create_draft",
		],
		authConfigId: process.env.GMAIL_AUTH_CONFIG_ID,
	},
	GITHUB: {
		name: "GitHub",
		description: "Manage repositories, issues, pull requests, and code",
		toolCategories: ["development", "version_control"],
		commonActions: ["create_issue", "create_pr", "list_repos", "get_repo_info"],
		authConfigId: process.env.GITHUB_AUTH_CONFIG_ID,
	},
	SLACK: {
		name: "Slack",
		description: "Send messages, manage channels, and team communication",
		toolCategories: ["communication", "team"],
		commonActions: ["send_message", "list_channels", "get_channel_history"],
		authConfigId: process.env.SLACK_AUTH_CONFIG_ID,
	},
	NOTION: {
		name: "Notion",
		description: "Create pages, databases, and manage workspace content",
		toolCategories: ["productivity", "notes"],
		commonActions: [
			"create_page",
			"search_pages",
			"create_database",
			"query_database",
		],
		authConfigId: process.env.NOTION_AUTH_CONFIG_ID,
	},
	CLICKUP: {
		name: "ClickUp",
		description:
			"Manage tasks, projects, time tracking, and team collaboration",
		toolCategories: ["productivity", "project_management", "task_tracking"],
		commonActions: [
			"create_task",
			"get_tasks",
			"update_task",
			"create_list",
			"track_time",
			"create_goal",
		],
		authConfigId: process.env.CLICKUP_AUTH_CONFIG_ID,
	},
	LINEAR: {
		name: "Linear",
		description:
			"Streamlined issue tracking and project management for modern teams",
		toolCategories: ["productivity", "project_management", "issue_tracking"],
		commonActions: [
			"create_issue",
			"list_issues",
			"update_issue",
			"create_project",
			"list_projects",
			"get_teams",
		],
		authConfigId: process.env.LINEAR_AUTH_CONFIG_ID,
	},
} as const;

// Initialize Composio client with OpenAI provider
export function createComposioClient(): Composio {
	if (!process.env.COMPOSIO_API_KEY) {
		throw new Error("COMPOSIO_API_KEY environment variable is required");
	}

	return new Composio({
		apiKey: process.env.COMPOSIO_API_KEY,
		provider: new OpenAIProvider(),
	});
}

// Tool cache to avoid repeated API calls
const toolCache = new Map<string, { tools: any[]; timestamp: number }>();
const TOOL_CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// API fallback mapping - when dashboard tools aren't available, use these alternatives
const API_TOOL_FALLBACKS: Record<string, string[]> = {
	GITHUB_LIST_REPOSITORIES_FOR_THE_AUTHENTICATED_USER: [
		"GITHUB_FIND_REPOSITORIES",
		"GITHUB_LIST_ORGANIZATION_REPOSITORIES",
		"GITHUB_ACTIVITY_LIST_REPO_S_STARRED_BY_AUTHENTICATED_USER",
	],
	GITHUB_LIST_PULL_REQUESTS: [
		"GITHUB_FIND_PULL_REQUESTS",
		"GITHUB_LIST_PULL_REQUESTS_FOR_A_REPOSITORY",
	],
	GITHUB_GET_AUTHENTICATED_USER: [
		"GITHUB_GET_THE_AUTHENTICATED_USER",
		"GITHUB_AUTH_USER_DOCKER_CONFLICT_PACKAGES_LIST", // Any auth user tool as fallback
	],
	GITHUB_UPDATE_AN_ISSUE: ["GITHUB_ISSUES_UPDATE"],
	GITHUB_UPDATE_A_PULL_REQUEST: ["GITHUB_PULLS_UPDATE"],
	GITHUB_GET_AN_ISSUE: ["GITHUB_ISSUES_GET"],
	GITHUB_GET_A_PULL_REQUEST: ["GITHUB_PULLS_GET"],
	GITHUB_GET_A_REPOSITORY: ["GITHUB_REPOS_GET"],
};

// Fetch ALL available tools for connected apps and cache them
export async function getAllToolsForApps(
	composio: Composio,
	entityId: string,
	apps: AvailableApp[],
	useCache: boolean = true
): Promise<ComposioTool[]> {
	try {
		if (apps.length === 0) {
			return [];
		}

		logger.info(
			`Fetching ALL tools for apps: ${apps.join(", ")} with entityId: ${entityId}`
		);

		const cacheKey = `all-tools-${entityId}-${apps.join(",")}`;

		// Check cache first
		if (useCache && toolCache.has(cacheKey)) {
			const cached = toolCache.get(cacheKey);
			if (cached && Date.now() - cached.timestamp < TOOL_CACHE_DURATION) {
				logger.info(`Using cached ALL tools: ${cached.tools.length} tools`);
				return cached.tools;
			} else {
				toolCache.delete(cacheKey); // Remove expired cache
			}
		}

		const allTools: ComposioTool[] = [];

		// Fetch ALL tools for each app
		for (const app of apps) {
			const authConfigId = APP_CONFIGS[app]?.authConfigId;

			if (!authConfigId) {
				console.warn(`[Composio] No auth config ID found for ${app}`);
				continue;
			}

			try {
				console.log(
					`[Composio] Fetching ALL tools for ${app} (authConfigId: ${authConfigId})`
				);

				// Fetch maximum available tools
				const tools = await composio.tools.get(entityId, {
					authConfigIds: [authConfigId],
					limit: 1000, // Get as many as possible
				});

				const toolsArray = Object.values(tools || {});
				console.log(
					`[Composio] Fetched ${toolsArray.length} raw tools for ${app}`
				);

				// Process tools to standard format without filtering
				const processedTools = toolsArray
					.map((tool: any) => {
						const functionName = tool.function?.name || tool.name || "";
						return {
							...tool,
							name: tool.function?.name || tool.name,
							description: tool.function?.description || tool.description,
							toolkit: app.toLowerCase(),
							app: app.toLowerCase(),
							_originalName: functionName,
							// Add metadata for smart filtering later
							_isDashboardTool: ((DASHBOARD_TOOLS as any)[app] || []).includes(
								functionName
							),
							_priority: TOOL_PRIORITY_MAP[functionName] || TOOL_PRIORITIES.LOW,
						};
					})
					.filter((tool: any) => {
						const toolName = tool.name || "";

						// Basic validation only
						if (!toolName || toolName.length === 0) return false;
						if (toolName.length > 64) return false; // OpenAI limit
						if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) return false; // Valid characters only

						return true;
					});

				allTools.push(...processedTools);
				console.log(
					`[Composio] Added ${processedTools.length} processed tools for ${app}`
				);
			} catch (appError) {
				console.warn(
					`[Composio] Failed to fetch tools for ${app}:`,
					appError instanceof Error ? appError.message : String(appError)
				);
			}
		}

		// Remove duplicates and validate for OpenAI
		const uniqueTools = removeDuplicateTools(allTools);
		const validatedTools = validateToolsForOpenAI(uniqueTools);

		// Cache the results
		if (useCache) {
			toolCache.set(cacheKey, {
				tools: validatedTools,
				timestamp: Date.now(),
			});
		}

		console.log(
			`[Composio] Cached ALL tools: ${validatedTools.length} total validated tools`
		);

		return validatedTools;
	} catch (error) {
		console.error("Error fetching all tools for apps:", error);
		return [];
	}
}

/**
 * Selects and ranks tools relevant to a natural-language query.
 *
 * Filters to a single app when the query uniquely implies one app, scores remaining tools
 * by dashboard status, configured priority, keyword matches (name and description), and
 * action-type matches (create/list/get/update/delete/send), then returns the top-scoring tools.
 *
 * @param allTools - Array of tool objects to consider. Each tool may include fields like `name`, `description`, `app`, `_isDashboardTool`, and `_priority`.
 * @param query - The user's natural-language query used to derive keywords and action intent.
 * @param options.maxTools - Maximum number of tools to return (default: 100).
 * @param options.preferDashboard - Whether to boost dashboard tools when scoring (default: true).
 * @param options.keywords - Additional keywords to consider alongside those extracted from `query`.
 * @returns An array of the selected tool objects sorted by descending relevance. Each returned tool includes an added `_score` numeric field representing its computed relevance.
 */
export function filterToolsForQuery(
	allTools: any[],
	query: string,
	options: {
		maxTools?: number;
		preferDashboard?: boolean;
		keywords?: string[];
	} = {}
): any[] {
	const { maxTools = 100, preferDashboard = true, keywords = [] } = options;

	const queryLower = query.toLowerCase();
	const extractedKeywords = extractKeywordsFromQuery(queryLower);
	const allKeywords = [...keywords, ...extractedKeywords];

	console.log(
		`[Tool Filter] Filtering ${allTools.length} tools for query: "${query}"`
	);
	console.log(`[Tool Filter] Keywords: ${allKeywords.join(", ")}`);

	// Determine app focus
	const needsGithub = allKeywords.some((k) =>
		[
			"github",
			"repo",
			"repository",
			"issue",
			"pull",
			"commit",
			"branch",
		].includes(k)
	);
	const needsGmail = allKeywords.some((k) =>
		["gmail", "email", "send", "mail", "inbox", "draft"].includes(k)
	);
	const needsSlack = allKeywords.some((k) =>
		[
			"slack",
			"channel",
			"message",
			"dm",
			"conversation",
			"workspace",
			"team",
		].includes(k)
	);
	const needsNotion = allKeywords.some((k) =>
		["notion", "page", "database", "block", "note", "doc", "document"].includes(
			k
		)
	);
	const needsClickup = allKeywords.some((k) =>
		[
			"clickup",
			"task",
			"project",
			"list",
			"folder",
			"space",
			"goal",
			"tracking",
		].includes(k)
	);
	const needsLinear = allKeywords.some((k) =>
		[
			"linear",
			"issue",
			"ticket",
			"bug",
			"feature",
			"cycle",
			"sprint",
			"project",
		].includes(k)
	);

	let filteredTools = allTools;

	// Filter by app if specific app is mentioned - using map-based approach for maintainability
	const appRequests: Record<string, boolean> = {
		github: needsGithub,
		gmail: needsGmail,
		slack: needsSlack,
		notion: needsNotion,
		clickup: needsClickup,
		linear: needsLinear,
	};

	// Determine which apps are requested
	const requestedApps = Object.entries(appRequests)
		.filter(([_, isRequested]) => isRequested)
		.map(([app, _]) => app);

	// If exactly one app is requested, filter tools to that app
	if (requestedApps.length === 1) {
		const targetApp = requestedApps[0];
		filteredTools = allTools.filter(
			(tool) => tool.app?.toLowerCase() === targetApp
		);
	}
	// Otherwise, use all tools (multi-app or no specific app)
	const scoredTools = filteredTools.map((tool) => {
		let score = 0;
		const toolName = tool.name.toLowerCase();
		const toolDesc = (tool.description || "").toLowerCase();

		// Dashboard tools get priority
		if (tool._isDashboardTool && preferDashboard) {
			score += 100;
		}

		// Priority scoring
		if (tool._priority === TOOL_PRIORITIES.HIGH) {
			score += 50;
		} else if (tool._priority === TOOL_PRIORITIES.MEDIUM) {
			score += 25;
		}

		// Keyword matching
		allKeywords.forEach((keyword) => {
			if (toolName.includes(keyword)) {
				score += 30;
			} else if (toolDesc.includes(keyword)) {
				score += 15;
			}
		});

		// Action type matching
		if (queryLower.includes("create") && toolName.includes("create")) {
			score += 40;
		} else if (
			queryLower.includes("list") &&
			(toolName.includes("list") || toolName.includes("find"))
		) {
			score += 40;
		} else if (queryLower.includes("get") && toolName.includes("get")) {
			score += 40;
		} else if (queryLower.includes("update") && toolName.includes("update")) {
			score += 40;
		} else if (queryLower.includes("delete") && toolName.includes("delete")) {
			score += 40;
		} else if (queryLower.includes("send") && toolName.includes("send")) {
			score += 40;
		}

		return { ...tool, _score: score };
	});

	// Sort by score (descending) and take top tools
	const selectedTools = scoredTools
		.sort((a, b) => b._score - a._score)
		.slice(0, maxTools);

	console.log(
		`[Tool Filter] Selected ${selectedTools.length} tools (top scores: ${selectedTools
			.slice(0, 5)
			.map((t) => `${t.name}:${t._score}`)
			.join(", ")})`
	);

	return selectedTools;
}

/**
 * Extracts recognized technology, action, and object keywords from a freeform query.
 *
 * Scans the input query case-insensitively for a predefined set of tech (e.g., "github", "slack"), action (e.g., "create", "list"), and object (e.g., "issue", "task") keywords and returns the unique matches in no particular order.
 *
 * @param query - The freeform text to analyze for keywords.
 * @returns The unique keywords found in `query`, or an empty array if none are present.
 */
function extractKeywordsFromQuery(query: string): string[] {
	const keywords = new Set<string>();
	const words = query.toLowerCase().split(/\s+/);

	// Technology keywords
	const techKeywords = [
		"github",
		"gmail",
		"email",
		"slack",
		"notion",
		"clickup",
		"linear",
	];
	// Action keywords
	const actionKeywords = [
		"create",
		"update",
		"delete",
		"send",
		"get",
		"list",
		"search",
		"find",
	];
	// Object keywords
	const objectKeywords = [
		"repo",
		"repository",
		"issue",
		"pull",
		"request",
		"commit",
		"branch",
		"email",
		"message",
		"draft",
		"channel",
		"conversation",
		"dm",
		"workspace",
		"team",
		"reminder",
		"reaction",
		"emoji",
		"page",
		"database",
		"block",
		"note",
		"doc",
		"document",
		"content",
		"task",
		"project",
		"list",
		"folder",
		"space",
		"goal",
		"checklist",
		"time",
		"tracking",
		"ticket",
		"bug",
		"feature",
		"cycle",
		"sprint",
	];

	const allKeywords = [...techKeywords, ...actionKeywords, ...objectKeywords];

	words.forEach((word) => {
		if (allKeywords.includes(word)) {
			keywords.add(word);
		}
	});

	return Array.from(keywords);
}

// Legacy wrapper for backward compatibility
// Process tools for a specific app with intelligent filtering
function _processAppTools(
	toolsArray: ComposioTool[],
	app: AvailableApp,
	options: ProcessToolOptions
): ComposioTool[] {
	const { maxTools, priorityLevel, keywords, dashboardTools } = options;

	// Transform tools to standard format
	const processedTools = toolsArray
		.map((tool: ComposioTool) => {
			const functionName = tool.function?.name || tool.name || "";
			return {
				...tool,
				name: tool.function?.name || tool.name,
				description: tool.function?.description || tool.description,
				toolkit: app.toLowerCase(),
				app: app.toLowerCase(),
				_originalName: functionName,
			};
		})
		.filter((tool: any) => {
			const toolName = tool.name || "";

			// Basic validation
			if (!toolName || toolName.length === 0) return false;
			if (toolName.length > 64) return false; // OpenAI limit
			if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) return false; // Valid characters only

			return true;
		});

	// Apply smart filtering strategy
	let filteredTools: any[] = [];

	// Strategy 1: Try to get dashboard tools first
	if (dashboardTools.length > 0) {
		const dashboardMatches = processedTools.filter(
			(tool) =>
				(tool.name && dashboardTools.includes(tool.name)) ||
				(tool._originalName && dashboardTools.includes(tool._originalName))
		);

		// Also check for API fallbacks for missing dashboard tools
		const missingDashboardTools = dashboardTools.filter(
			(dashboardTool) =>
				!dashboardMatches.some(
					(tool) =>
						tool.name === dashboardTool || tool._originalName === dashboardTool
				)
		);

		const fallbackMatches: any[] = [];
		missingDashboardTools.forEach((missingTool) => {
			const fallbacks = API_TOOL_FALLBACKS[missingTool] || [];
			fallbacks.forEach((fallback) => {
				const match = processedTools.find(
					(tool) => tool.name === fallback || tool._originalName === fallback
				);
				if (match && !fallbackMatches.includes(match)) {
					fallbackMatches.push(match);
				}
			});
		});

		filteredTools = [...dashboardMatches, ...fallbackMatches];
		console.log(
			`[Composio] ${app}: Found ${dashboardMatches.length} dashboard tools + ${fallbackMatches.length} fallbacks`
		);
	}

	// Strategy 2: If we don't have enough tools, use priority-based selection
	if (filteredTools.length < maxTools) {
		const remainingSlots = maxTools - filteredTools.length;
		const existingNames = new Set(filteredTools.map((t) => t.name));

		// Get tools by priority
		const priorityTools = processedTools
			.filter((tool) => tool.name && !existingNames.has(tool.name))
			.map((tool) => ({
				...tool,
				priority:
					(tool.name && TOOL_PRIORITY_MAP[tool.name]) || TOOL_PRIORITIES.LOW,
			}))
			.filter((tool) => tool.priority <= priorityLevel)
			.sort((a, b) => a.priority - b.priority) // Higher priority first (lower number)
			.slice(0, remainingSlots);

		filteredTools.push(...priorityTools);
		console.log(
			`[Composio] ${app}: Added ${priorityTools.length} priority tools`
		);
	}

	// Strategy 3: If we still need more and have keywords, use keyword matching
	if (filteredTools.length < maxTools && keywords.length > 0) {
		const remainingSlots = maxTools - filteredTools.length;
		const existingNames = new Set(filteredTools.map((t) => t.name));

		const keywordTools = processedTools
			.filter((tool) => tool.name && !existingNames.has(tool.name))
			.filter((tool) => {
				if (!tool.name) return false;
				const toolName = tool.name.toLowerCase();
				const toolDesc = (tool.description || "").toLowerCase();
				return keywords.some(
					(keyword) =>
						toolName.includes(keyword.toLowerCase()) ||
						toolDesc.includes(keyword.toLowerCase())
				);
			})
			.slice(0, remainingSlots);

		filteredTools.push(...keywordTools);
		console.log(
			`[Composio] ${app}: Added ${keywordTools.length} keyword-matching tools`
		);
	}

	// Strategy 4: Fill remaining slots with most commonly used tools (alphabetically first as proxy)
	if (filteredTools.length < maxTools) {
		const remainingSlots = maxTools - filteredTools.length;
		const existingNames = new Set(filteredTools.map((t) => t.name));

		const commonTools = processedTools
			.filter((tool) => tool.name && !existingNames.has(tool.name))
			.sort((a, b) => (a.name || "").localeCompare(b.name || "")) // Alphabetical as proxy for common tools
			.slice(0, remainingSlots);

		filteredTools.push(...commonTools);
		console.log(
			`[Composio] ${app}: Added ${commonTools.length} common tools to fill remaining slots`
		);
	}

	return filteredTools.slice(0, maxTools); // Ensure we don't exceed the limit
}

// Remove duplicate tools based on function name
function removeDuplicateTools(tools: ComposioTool[]): ComposioTool[] {
	const seen = new Set<string>();
	return tools.filter((tool) => {
		const toolName = tool.name || tool.function?.name;
		if (!toolName || seen.has(toolName)) {
			return false;
		}
		seen.add(toolName);
		return true;
	});
}

// Helper to ensure consistent entity ID format for workspace connections
export function getWorkspaceEntityId(workspaceId: string): string {
	return `workspace_${workspaceId}`;
}

// Helper to check if user has connected accounts for specific apps
export async function getConnectedApps(
	composio: Composio,
	entityId: string
): Promise<{ app: AvailableApp; connected: boolean; connectionId?: string }[]> {
	try {
		const connectionsResponse = await composio.connectedAccounts.list({
			userIds: [entityId],
		});

		const connections = connectionsResponse.items || [];

		return Object.values(AVAILABLE_APPS).map((app) => {
			const connection = connections.find(
				(conn: any) =>
					conn.toolkit?.slug?.toUpperCase() === app ||
					conn.appName?.toUpperCase() === app ||
					conn.integrationId?.toUpperCase() === app
			);

			return {
				app,
				connected: !!connection && connection.status === "ACTIVE",
				connectionId: connection?.id,
			};
		});
	} catch (error) {
		console.error("Error checking connected apps:", error);
		return Object.values(AVAILABLE_APPS).map((app) => ({
			app,
			connected: false,
		}));
	}
}

/**
 * Filter a list of tools to those compatible with OpenAI function-calling constraints.
 *
 * Performs concrete validations and excludes tools that violate OpenAI-compatible requirements:
 * - function name must exist, be at most 64 characters, and contain only letters, numbers, underscores or hyphens
 * - description (if present) must be at most 1000 characters
 * - `function.parameters` (if present) must be JSON-serializable
 *
 * @param tools - The tools to validate
 * @returns The subset of `tools` that passed OpenAI compatibility checks
 */
function validateToolsForOpenAI(tools: ComposioTool[]): ComposioTool[] {
	const validTools: ComposioTool[] = [];

	for (let i = 0; i < tools.length; i++) {
		const tool = tools[i];
		const toolName = tool.function?.name || tool.name || "";

		try {
			// Check function name length (OpenAI limit: 64 characters)
			if (toolName.length > 64) {
				console.warn(
					`[OpenAI Validation] Tool ${i}: Name too long (${toolName.length} chars): ${toolName}`
				);
				continue;
			}

			// Check if function name contains only valid characters
			if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
				console.warn(
					`[OpenAI Validation] Tool ${i}: Invalid characters in name: ${toolName}`
				);
				continue;
			}

			// Check description length (reasonable limit)
			const description = tool.function?.description || tool.description || "";
			if (description.length > 1000) {
				console.warn(
					`[OpenAI Validation] Tool ${i}: Description too long (${description.length} chars): ${toolName}`
				);
				continue;
			}

			// Check parameters structure
			const parameters = tool.function?.parameters;
			if (parameters && typeof parameters === "object") {
				try {
					JSON.stringify(parameters);
				} catch (_e) {
					console.warn(
						`[OpenAI Validation] Tool ${i}: Invalid parameters JSON: ${toolName}`
					);
					continue;
				}
			}

			// Validate required structure
			if (!tool.function?.name) {
				console.warn(
					`[OpenAI Validation] Tool ${i}: Missing function.name: ${JSON.stringify(tool).substring(0, 100)}`
				);
				continue;
			}

			validTools.push(tool);
		} catch (error) {
			console.warn(
				`[OpenAI Validation] Tool ${i}: Validation error for ${toolName}:`,
				error
			);
		}
	}

	console.log(
		`[OpenAI Validation] Validated ${validTools.length}/${tools.length} tools`
	);
	return validTools;
}

/**
 * Determine which supported apps have active connections for a given entity or workspace.
 *
 * Queries Composio for entity-specific connections (using `entityId` if provided, otherwise `workspace_<workspaceId>`).
 * If no entity-specific connections are found and no explicit `entityId` was requested, falls back to global connections for backward compatibility.
 *
 * @param workspaceId - Workspace identifier kept for backward compatibility; used to construct a workspace-scoped entity id when `entityId` is not provided.
 * @param entityId - Optional explicit entity id to check (for example `member_123` or `workspace_456`); when provided, global fallback is not used.
 * @returns An array of ConnectedApp objects for each supported app indicating whether it is connected, the chosen connection id when connected, and the entity id used for the connection (present only when a connection was found).
 */
export async function getAnyConnectedApps(
	composio: Composio,
	workspaceId: string, // Keep workspaceId for backward compatibility
	entityId?: string // Optional: specific entity ID (e.g., member_123 or workspace_456)
): Promise<ConnectedApp[]> {
	try {
		// Use provided entityId or fall back to workspace-scoped entity ID
		const targetEntityId = entityId || `workspace_${workspaceId}`;

		console.log(
			`[Composio] Checking connections for entity: ${targetEntityId}`
		);

		// Get entity-specific connections
		let entityConnections: ComposioConnection[] = [];
		try {
			const entityConnectionsResponse = await composio.connectedAccounts.list({
				userIds: [targetEntityId],
			});
			entityConnections = entityConnectionsResponse.items || [];
			console.log(
				"[Composio] Found",
				entityConnections.length,
				"connections for entity",
				targetEntityId
			);
		} catch (error) {
			console.warn(
				`[Composio] Failed to get connections for entity ${targetEntityId}:`,
				error
			);
		}

		// Only fall back to global connections if no entity connections found
		// and only for backward compatibility
		let globalConnections: ComposioConnection[] = [];
		if (entityConnections.length === 0 && !entityId) {
			// Only fallback if no specific entityId was requested
			try {
				const globalConnectionsResponse = await composio.connectedAccounts.list(
					{}
				);
				globalConnections = globalConnectionsResponse.items || [];
				console.log(
					"[Composio] Fallback: Found",
					globalConnections.length,
					"global connections (for backward compatibility)"
				);
			} catch (error) {
				console.warn("[Composio] Failed to get global connections:", error);
			}
		}

		// Prioritize entity-specific connections, use global only as fallback
		const allConnections = [...entityConnections, ...globalConnections];
		console.log("[Composio] Total connections:", allConnections.length);

		return Object.values(AVAILABLE_APPS).map((app) => {
			// Find all connections for this app
			const appConnections = allConnections.filter(
				(conn: ComposioConnection) =>
					conn.toolkit?.slug?.toUpperCase() === app ||
					conn.appName?.toUpperCase() === app ||
					conn.toolkit?.slug?.toUpperCase() === app.toLowerCase().toUpperCase()
			);

			// Prefer entity-specific connections, then newest
			const connection = appConnections
				.filter((conn: ComposioConnection) => conn.status === "ACTIVE")
				.sort((a: ComposioConnection, b: ComposioConnection) => {
					// Strongly prefer entity-specific connections
					const aIsEntity = entityConnections.includes(a);
					const bIsEntity = entityConnections.includes(b);
					if (aIsEntity && !bIsEntity) return -1;
					if (!aIsEntity && bIsEntity) return 1;

					// Then by creation date (newest first)
					return (
						new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
					);
				})[0];

			console.log(
				`[Composio] App ${app}: found ${appConnections.length} connections, using ${connection ? (entityConnections.includes(connection) ? "entity-specific" : "global (fallback)") : "none"}: connected=${!!connection}, connectionId=${connection?.id}, entityId=${targetEntityId}`
			);

			return {
				app,
				connected: !!connection,
				connectionId: connection?.id,
				// Return the actual entity ID used for this connection
				entityId: connection ? targetEntityId : undefined,
			};
		});
	} catch (error) {
		console.error("Error checking any connected apps:", error);
		return Object.values(AVAILABLE_APPS).map((app) => ({
			app,
			connected: false,
		}));
	}
}

/**
 * Cleans up old connections, keeping only the most recent ACTIVE connection.
 * Deletes connections in INITIATED, FAILED, EXPIRED status, and older ACTIVE connections.
 * This ensures only one active connection per user+authConfig.
 *
 * @param composio - The Composio instance
 * @param entityId - The target entity identifier
 * @param authConfigId - The auth config ID for the app
 * @param keepConnectionId - Optional connection ID to preserve (the newly created one)
 */
export async function cleanupOldConnections(
	composio: Composio,
	entityId: string,
	authConfigId: string,
	keepConnectionId?: string
) {
	try {
		const accounts = await composio.connectedAccounts.list({
			userIds: [entityId],
			authConfigIds: [authConfigId],
		});

		const allAccounts = accounts.items || [];

		// Sort by creation date (newest first)
		// Handle missing or invalid createdAt values by treating them as oldest
		const sortedAccounts: ComposioConnection[] = [...allAccounts].sort(
			(a, b) => {
				const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
				const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
				// Return 0 if both are invalid to maintain stable sort
				if (Number.isNaN(timeA) && Number.isNaN(timeB)) return 0;
				if (Number.isNaN(timeA)) return 1; // a is older (move to end)
				if (Number.isNaN(timeB)) return -1; // b is older (move to end)
				return timeB - timeA; // Newest first
			}
		);

		// Determine which connections to delete
		const accountsToDelete = sortedAccounts.filter((acc) => {
			// Always keep the specified connection (even if INITIATED)
			if (keepConnectionId && acc.id === keepConnectionId) {
				return false;
			}

			// Delete failed/expired/initiated connections
			if (
				acc.status === "INITIATED" ||
				acc.status === "FAILED" ||
				acc.status === "EXPIRED"
			) {
				return true;
			}

			// For ACTIVE connections: delete if not the keeper and not the newest ACTIVE
			if (acc.status === "ACTIVE") {
				// If we have a keeper, delete all other ACTIVE connections
				if (keepConnectionId) {
					return true;
				}
				// Otherwise keep only the newest ACTIVE
				const newerActiveExists = sortedAccounts.some((other) => {
					if (other.status !== "ACTIVE" || other.id === acc.id) {
						return false;
					}
					// Handle invalid dates by coercing to sentinel value
					const otherTs = new Date(other.createdAt).getTime();
					const accTs = new Date(acc.createdAt).getTime();
					const safeOtherTs = Number.isNaN(otherTs) ? -Infinity : otherTs;
					const safeAccTs = Number.isNaN(accTs) ? -Infinity : accTs;
					return safeOtherTs > safeAccTs;
				});
				return newerActiveExists;
			}

			return false;
		});

		// Delete each old connection
		for (const acc of accountsToDelete) {
			try {
				await composio.connectedAccounts.delete(acc.id);
			} catch (deleteError) {
				// Log deletion failure but continue with other deletions
				const logMessage = `Failed to delete connection ${acc.id}: ${deleteError}`;
				if (logger?.warn) {
					logger.warn(logMessage);
				} else {
					console.warn(logMessage);
				}
			}
		}
	} catch (error) {
		// Log cleanup failure but don't fail the connection process
		const logMessage = `Connected accounts cleanup failed: ${error}`;
		if (logger?.error) {
			logger.error(logMessage);
		} else {
			console.error(logMessage);
		}
	}
}

/**
 * Initiates a connection flow for the specified app and entity, returning a redirect URL to complete authentication.
 *
 * PRODUCTION-SAFE: Uses allowMultiple to permit the new connection, then cleans up old connections afterward.
 * This ensures the connection succeeds even if old connections exist, then maintains only one active connection.
 *
 * @param entityId - The target entity identifier (e.g., workspace or user) to associate with the connection
 * @param app - The app to connect (one of AVAILABLE_APPS)
 * @param callbackUrl - Optional callback URL to override the default integration callback
 * @returns An object `{ success: true, redirectUrl, connectionId }` on success, or `{ success: false, error }` on failure
 */
export async function initiateAppConnection(
	composio: Composio,
	entityId: string,
	app: AvailableApp,
	callbackUrl?: string
) {
	try {
		// Get the auth config ID for this app
		const authConfigId = APP_CONFIGS[app]?.authConfigId;

		if (!authConfigId) {
			throw new Error(`Auth config ID not found for ${app}`);
		}

		const connection = await composio.connectedAccounts.initiate(
			entityId,
			authConfigId,
			{
				allowMultiple: true,
				callbackUrl:
					callbackUrl ||
					`${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
			}
		);

		// Clean up old connections in background
		cleanupOldConnections(
			composio,
			entityId,
			authConfigId,
			connection.id
		).catch(() => {});

		return {
			success: true,
			redirectUrl: connection.redirectUrl,
			connectionId: connection.id,
		};
	} catch (error) {
		return {
			success: false,
			error: error instanceof Error ? error.message : "Unknown error",
		};
	}
}
