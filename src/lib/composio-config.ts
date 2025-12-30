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
  status: string;
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

  // Medium priority tools
  GITHUB_ADD_ASSIGNEES_TO_AN_ISSUE: TOOL_PRIORITIES.MEDIUM,
  GITHUB_ADD_LABELS_TO_AN_ISSUE: TOOL_PRIORITIES.MEDIUM,
  GITHUB_CREATE_AN_ISSUE_COMMENT: TOOL_PRIORITIES.MEDIUM,
  GMAIL_GET_LABELS: TOOL_PRIORITIES.MEDIUM,
  GMAIL_MARK_AS_READ: TOOL_PRIORITIES.MEDIUM,
  GMAIL_FORWARD_EMAIL: TOOL_PRIORITIES.MEDIUM,
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
    authConfigId: process.env.NEXT_PUBLIC_GMAIL_AUTH_CONFIG_ID,
  },
  GITHUB: {
    name: "GitHub",
    description: "Manage repositories, issues, pull requests, and code",
    toolCategories: ["development", "version_control"],
    commonActions: ["create_issue", "create_pr", "list_repos", "get_repo_info"],
    authConfigId: process.env.NEXT_PUBLIC_GITHUB_AUTH_CONFIG_ID,
  },
  SLACK: {
    name: "Slack",
    description: "Send messages, manage channels, and team communication",
    toolCategories: ["communication", "team"],
    commonActions: ["send_message", "list_channels", "get_channel_history"],
    authConfigId: process.env.NEXT_PUBLIC_SLACK_AUTH_CONFIG_ID,
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
    authConfigId: process.env.NEXT_PUBLIC_NOTION_AUTH_CONFIG_ID, // Will need to create this
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
  useCache: boolean = true,
): Promise<ComposioTool[]> {
  try {
    if (apps.length === 0) {
      return [];
    }

    logger.info(
      `Fetching ALL tools for apps: ${apps.join(", ")} with entityId: ${entityId}`,
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

    let allTools: ComposioTool[] = [];

    // Fetch ALL tools for each app
    for (const app of apps) {
      const authConfigId = APP_CONFIGS[app]?.authConfigId;

      if (!authConfigId) {
        console.warn(`[Composio] No auth config ID found for ${app}`);
        continue;
      }

      try {
        console.log(
          `[Composio] Fetching ALL tools for ${app} (authConfigId: ${authConfigId})`,
        );

        // Fetch maximum available tools
        const tools = await composio.tools.get(entityId, {
          authConfigIds: [authConfigId],
          limit: 1000, // Get as many as possible
        });

        const toolsArray = Object.values(tools || {});
        console.log(
          `[Composio] Fetched ${toolsArray.length} raw tools for ${app}`,
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
                functionName,
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
          `[Composio] Added ${processedTools.length} processed tools for ${app}`,
        );
      } catch (appError) {
        console.warn(
          `[Composio] Failed to fetch tools for ${app}:`,
          appError instanceof Error ? appError.message : String(appError),
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
      `[Composio] Cached ALL tools: ${validatedTools.length} total validated tools`,
    );

    return validatedTools;
  } catch (error) {
    console.error("Error fetching all tools for apps:", error);
    return [];
  }
}

// Filter tools based on query context and needs
export function filterToolsForQuery(
  allTools: any[],
  query: string,
  options: {
    maxTools?: number;
    preferDashboard?: boolean;
    keywords?: string[];
  } = {},
): any[] {
  const { maxTools = 100, preferDashboard = true, keywords = [] } = options;

  const queryLower = query.toLowerCase();
  const extractedKeywords = extractKeywordsFromQuery(queryLower);
  const allKeywords = [...keywords, ...extractedKeywords];

  console.log(
    `[Tool Filter] Filtering ${allTools.length} tools for query: "${query}"`,
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
    ].includes(k),
  );
  const needsGmail = allKeywords.some((k) =>
    ["gmail", "email", "send", "mail", "inbox", "draft"].includes(k),
  );
  const needsSlack = allKeywords.some((k) =>
    ["slack", "channel", "message"].includes(k),
  );

  let filteredTools = allTools;

  // Filter by app if specific app is mentioned
  if (needsGithub && !needsGmail && !needsSlack) {
    filteredTools = allTools.filter((tool) => tool.app === "github");
  } else if (needsGmail && !needsGithub && !needsSlack) {
    filteredTools = allTools.filter((tool) => tool.app === "gmail");
  } else if (needsSlack && !needsGithub && !needsGmail) {
    filteredTools = allTools.filter((tool) => tool.app === "slack");
  }

  // Score and sort tools
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
      .join(", ")})`,
  );

  return selectedTools;
}

// Extract keywords from query
function extractKeywordsFromQuery(query: string): string[] {
  const keywords = new Set<string>();
  const words = query.toLowerCase().split(/\s+/);

  // Technology keywords
  const techKeywords = ["github", "gmail", "email", "slack", "notion"];
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
function processAppTools(
  toolsArray: ComposioTool[],
  app: AvailableApp,
  options: ProcessToolOptions,
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
        (tool._originalName && dashboardTools.includes(tool._originalName)),
    );

    // Also check for API fallbacks for missing dashboard tools
    const missingDashboardTools = dashboardTools.filter(
      (dashboardTool) =>
        !dashboardMatches.some(
          (tool) =>
            tool.name === dashboardTool || tool._originalName === dashboardTool,
        ),
    );

    const fallbackMatches: any[] = [];
    missingDashboardTools.forEach((missingTool) => {
      const fallbacks = API_TOOL_FALLBACKS[missingTool] || [];
      fallbacks.forEach((fallback) => {
        const match = processedTools.find(
          (tool) => tool.name === fallback || tool._originalName === fallback,
        );
        if (match && !fallbackMatches.includes(match)) {
          fallbackMatches.push(match);
        }
      });
    });

    filteredTools = [...dashboardMatches, ...fallbackMatches];
    console.log(
      `[Composio] ${app}: Found ${dashboardMatches.length} dashboard tools + ${fallbackMatches.length} fallbacks`,
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
      `[Composio] ${app}: Added ${priorityTools.length} priority tools`,
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
            toolDesc.includes(keyword.toLowerCase()),
        );
      })
      .slice(0, remainingSlots);

    filteredTools.push(...keywordTools);
    console.log(
      `[Composio] ${app}: Added ${keywordTools.length} keyword-matching tools`,
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
      `[Composio] ${app}: Added ${commonTools.length} common tools to fill remaining slots`,
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
  entityId: string,
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
          conn.integrationId?.toUpperCase() === app,
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

// Validate tools for OpenAI compatibility
function validateToolsForOpenAI(tools: ComposioTool[]): ComposioTool[] {
  const validTools: ComposioTool[] = [];

  for (let i = 0; i < tools.length; i++) {
    const tool = tools[i];
    const toolName = tool.function?.name || tool.name || "";

    try {
      // Check function name length (OpenAI limit: 64 characters)
      if (toolName.length > 64) {
        console.warn(
          `[OpenAI Validation] Tool ${i}: Name too long (${toolName.length} chars): ${toolName}`,
        );
        continue;
      }

      // Check if function name contains only valid characters
      if (!/^[a-zA-Z0-9_-]+$/.test(toolName)) {
        console.warn(
          `[OpenAI Validation] Tool ${i}: Invalid characters in name: ${toolName}`,
        );
        continue;
      }

      // Check description length (reasonable limit)
      const description = tool.function?.description || tool.description || "";
      if (description.length > 1000) {
        console.warn(
          `[OpenAI Validation] Tool ${i}: Description too long (${description.length} chars): ${toolName}`,
        );
        continue;
      }

      // Check parameters structure
      const parameters = tool.function?.parameters;
      if (parameters && typeof parameters === "object") {
        try {
          JSON.stringify(parameters);
        } catch (e) {
          console.warn(
            `[OpenAI Validation] Tool ${i}: Invalid parameters JSON: ${toolName}`,
          );
          continue;
        }
      }

      // Validate required structure
      if (!tool.function?.name) {
        console.warn(
          `[OpenAI Validation] Tool ${i}: Missing function.name: ${JSON.stringify(tool).substring(0, 100)}`,
        );
        continue;
      }

      validTools.push(tool);
    } catch (error) {
      console.warn(
        `[OpenAI Validation] Tool ${i}: Validation error for ${toolName}:`,
        error,
      );
    }
  }

  console.log(
    `[OpenAI Validation] Validated ${validTools.length}/${tools.length} tools`,
  );
  return validTools;
}

// Helper to check connected accounts for specific entity (user-specific or workspace-wide)
export async function getAnyConnectedApps(
  composio: Composio,
  workspaceId: string, // Keep workspaceId for backward compatibility
  entityId?: string, // Optional: specific entity ID (e.g., member_123 or workspace_456)
): Promise<ConnectedApp[]> {
  try {
    // Use provided entityId or fall back to workspace-scoped entity ID
    const targetEntityId = entityId || `workspace_${workspaceId}`;

    console.log(
      `[Composio] Checking connections for entity: ${targetEntityId}`,
    );

    // Get entity-specific connections
    let entityConnections: ComposioConnection[] = [];
    try {
      const entityConnectionsResponse =
        await composio.connectedAccounts.list({
          userIds: [targetEntityId],
        });
      entityConnections = entityConnectionsResponse.items || [];
      console.log(
        "[Composio] Found",
        entityConnections.length,
        "connections for entity",
        targetEntityId,
      );
    } catch (error) {
      console.warn(
        `[Composio] Failed to get connections for entity ${targetEntityId}:`,
        error,
      );
    }

    // Only fall back to global connections if no entity connections found
    // and only for backward compatibility
    let globalConnections: ComposioConnection[] = [];
    if (entityConnections.length === 0 && !entityId) {
      // Only fallback if no specific entityId was requested
      try {
        const globalConnectionsResponse = await composio.connectedAccounts.list(
          {},
        );
        globalConnections = globalConnectionsResponse.items || [];
        console.log(
          "[Composio] Fallback: Found",
          globalConnections.length,
          "global connections (for backward compatibility)",
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
          conn.toolkit?.slug?.toUpperCase() === app.toLowerCase().toUpperCase(),
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
        `[Composio] App ${app}: found ${appConnections.length} connections, using ${connection ? (entityConnections.includes(connection) ? "entity-specific" : "global (fallback)") : "none"}: connected=${!!connection}, connectionId=${connection?.id}, entityId=${targetEntityId}`,
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

// Helper to initiate connection for an app
export async function initiateAppConnection(
  composio: Composio,
  entityId: string,
  app: AvailableApp,
  callbackUrl?: string,
) {
  try {
    // Get the auth config ID for this app
    const authConfigId = APP_CONFIGS[app]?.authConfigId;

    if (!authConfigId) {
      throw new Error(
        `Auth config ID not found for ${app}. Please check your environment variables.`,
      );
    }

    console.log(
      `[Composio] Initiating connection for ${app} with auth config ID: ${authConfigId}`,
    );

    const connection = await composio.connectedAccounts.initiate(
      entityId,
      authConfigId, // Use auth config ID instead of app name
      {
        callbackUrl:
          callbackUrl ||
          `${process.env.NEXT_PUBLIC_APP_URL}/integrations/callback`,
      },
    );

    return {
      success: true,
      redirectUrl: connection.redirectUrl,
      connectionId: connection.id,
    };
  } catch (error) {
    console.error(`Error initiating ${app} connection:`, error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    };
  }
}
