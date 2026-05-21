/**
 * Tool definitions for DatabaseChat.
 *
 * Supports two approaches:
 * 1. Explicit tools - you define exactly what queries the LLM can call
 * 2. Auto-tools - generated from your Convex schema
 *
 * @example Explicit tool
 * ```typescript
 * const searchTool: DatabaseChatTool = {
 *   name: "searchApplications",
 *   description: "Search applications by skill or candidate name",
 *   parameters: {
 *     type: "object",
 *     properties: {
 *       query: { type: "string", description: "Search query" },
 *       limit: { type: "number", description: "Max results" }
 *     },
 *     required: ["query"]
 *   },
 *   // Function handle string - created via createFunctionHandle()
 *   handler: functionHandleString,
 * };
 * ```
 */
import { v } from "convex/values";
// =============================================================================
// Tool Validators (for Convex args)
// =============================================================================
export const toolParameterSchemaValidator = v.object({
    type: v.literal("object"),
    properties: v.any(), // Complex nested structure
    required: v.optional(v.array(v.string())),
});
export const databaseChatToolValidator = v.object({
    name: v.string(),
    description: v.string(),
    parameters: toolParameterSchemaValidator,
    handlerType: v.optional(v.union(v.literal("query"), v.literal("mutation"), v.literal("action"))),
    handler: v.string(),
});
// =============================================================================
// Tool Helpers
// =============================================================================
/**
 * Format tools for OpenAI/OpenRouter function calling.
 */
export function formatToolsForLLM(tools) {
    return tools.map((tool) => ({
        type: "function",
        function: {
            name: tool.name,
            description: tool.description,
            parameters: tool.parameters,
        },
    }));
}
/**
 * Find a tool by name.
 */
export function findTool(tools, name) {
    return tools.find((t) => t.name === name);
}
/**
 * Validate tool call arguments against the schema.
 * Returns an error message if invalid, null if valid.
 */
export function validateToolArgs(tool, args) {
    const { parameters } = tool;
    const { properties, required = [] } = parameters;
    // Check required fields
    for (const field of required) {
        if (!(field in args)) {
            return `Missing required field: ${field}`;
        }
    }
    // Check field types
    for (const [key, value] of Object.entries(args)) {
        const schema = properties[key];
        if (!schema) {
            // Allow extra fields - LLM might add them
            continue;
        }
        const expectedType = schema.type;
        const actualType = Array.isArray(value) ? "array" : typeof value;
        if (expectedType !== actualType) {
            // Allow null for optional fields
            if (value === null && !required.includes(key)) {
                continue;
            }
            return `Field ${key} expected ${expectedType}, got ${actualType}`;
        }
        // Check enum values
        if (schema.enum && !schema.enum.includes(value)) {
            return `Field ${key} must be one of: ${schema.enum.join(", ")}`;
        }
    }
    return null;
}
// =============================================================================
// Built-in Generic Tools
// =============================================================================
/**
 * Create a generic "query table" tool.
 * This is useful when you want flexible querying without defining many tools.
 */
export function createQueryTableTool(allowedTables, handler) {
    return {
        name: "queryTable",
        description: `Query a database table with optional filters. Available tables: ${allowedTables.join(", ")}`,
        parameters: {
            type: "object",
            properties: {
                table: {
                    type: "string",
                    description: "The table to query",
                    enum: allowedTables,
                },
                filters: {
                    type: "object",
                    description: "Key-value filters to apply (e.g., { status: 'active' })",
                },
                limit: {
                    type: "number",
                    description: "Maximum number of results (default: 10)",
                },
                orderBy: {
                    type: "string",
                    description: "Field to order by",
                },
                order: {
                    type: "string",
                    description: "Sort order",
                    enum: ["asc", "desc"],
                },
            },
            required: ["table"],
        },
        handler,
    };
}
/**
 * Create a generic "count records" tool.
 */
export function createCountTool(allowedTables, handler) {
    return {
        name: "countRecords",
        description: `Count records in a table with optional filters. Available tables: ${allowedTables.join(", ")}`,
        parameters: {
            type: "object",
            properties: {
                table: {
                    type: "string",
                    description: "The table to count",
                    enum: allowedTables,
                },
                filters: {
                    type: "object",
                    description: "Key-value filters to apply",
                },
            },
            required: ["table"],
        },
        handler,
    };
}
/**
 * Create a generic "aggregate" tool for stats.
 */
export function createAggregateTool(allowedTables, handler) {
    return {
        name: "aggregate",
        description: `Calculate aggregations (sum, avg, min, max) on a numeric field. Available tables: ${allowedTables.join(", ")}`,
        parameters: {
            type: "object",
            properties: {
                table: {
                    type: "string",
                    description: "The table to aggregate",
                    enum: allowedTables,
                },
                field: {
                    type: "string",
                    description: "The numeric field to aggregate",
                },
                operation: {
                    type: "string",
                    description: "The aggregation operation",
                    enum: ["sum", "avg", "min", "max", "count"],
                },
                filters: {
                    type: "object",
                    description: "Optional filters to apply before aggregating",
                },
            },
            required: ["table", "field", "operation"],
        },
        handler,
    };
}
/**
 * Create a generic "search" tool using text search.
 */
export function createSearchTool(allowedTables, handler) {
    return {
        name: "searchRecords",
        description: `Full-text search across records. Available tables: ${allowedTables.join(", ")}`,
        parameters: {
            type: "object",
            properties: {
                table: {
                    type: "string",
                    description: "The table to search",
                    enum: allowedTables,
                },
                query: {
                    type: "string",
                    description: "The search query",
                },
                limit: {
                    type: "number",
                    description: "Maximum results (default: 10)",
                },
            },
            required: ["table", "query"],
        },
        handler,
    };
}
