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
/**
 * JSON Schema for tool parameters (OpenAI function calling format).
 */
export interface ToolParameterSchema {
    type: "object";
    properties: Record<string, {
        type: "string" | "number" | "boolean" | "array" | "object";
        description?: string;
        enum?: string[];
        items?: {
            type: string;
        };
    }>;
    required?: string[];
}
/**
 * A tool that the LLM can call.
 */
export interface DatabaseChatTool {
    /** Unique name for the tool (used by LLM to call it) */
    name: string;
    /** Human-readable description of what the tool does */
    description: string;
    /** JSON Schema describing the parameters */
    parameters: ToolParameterSchema;
    /**
     * Function type for the handler (default: "query").
     * Use "action" for tools that call ctx.vectorSearch or external APIs.
     */
    handlerType?: "query" | "mutation" | "action";
    /**
     * Function handle string to execute.
     * Create this using `createFunctionHandle(api.myQuery)` in your app code,
     * then pass the string to the component. Use `handlerType` for actions or
     * mutations (default: "query").
     */
    handler: string;
}
/**
 * Configuration for auto-generated tools.
 */
export interface AutoToolsConfig {
    /**
     * Tables to expose for querying.
     * Only these tables will have tools generated.
     */
    allowedTables: string[];
    /**
     * Fields to exclude from each table.
     * Use this to hide sensitive data like SSN, passwords, etc.
     */
    excludeFields?: Record<string, string[]>;
    /**
     * Custom descriptions for tables.
     * Helps the LLM understand what each table contains.
     */
    tableDescriptions?: Record<string, string>;
    /**
     * Custom descriptions for fields.
     * Format: { "tableName.fieldName": "description" }
     */
    fieldDescriptions?: Record<string, string>;
}
/**
 * Full tools configuration for DatabaseChat.
 */
export interface ToolsConfig {
    /** Explicitly defined tools */
    tools?: DatabaseChatTool[];
    /** Auto-generate tools from schema */
    autoTools?: AutoToolsConfig;
}
export declare const toolParameterSchemaValidator: import("convex/values").VObject<{
    required?: string[] | undefined;
    type: "object";
    properties: any;
}, {
    type: import("convex/values").VLiteral<"object", "required">;
    properties: import("convex/values").VAny<any, "required", string>;
    required: import("convex/values").VArray<string[] | undefined, import("convex/values").VString<string, "required">, "optional">;
}, "required", "required" | "type" | "properties" | `properties.${string}`>;
export declare const databaseChatToolValidator: import("convex/values").VObject<{
    handlerType?: "query" | "mutation" | "action" | undefined;
    name: string;
    parameters: {
        required?: string[] | undefined;
        type: "object";
        properties: any;
    };
    handler: string;
    description: string;
}, {
    name: import("convex/values").VString<string, "required">;
    description: import("convex/values").VString<string, "required">;
    parameters: import("convex/values").VObject<{
        required?: string[] | undefined;
        type: "object";
        properties: any;
    }, {
        type: import("convex/values").VLiteral<"object", "required">;
        properties: import("convex/values").VAny<any, "required", string>;
        required: import("convex/values").VArray<string[] | undefined, import("convex/values").VString<string, "required">, "optional">;
    }, "required", "required" | "type" | "properties" | `properties.${string}`>;
    handlerType: import("convex/values").VUnion<"query" | "mutation" | "action" | undefined, [import("convex/values").VLiteral<"query", "required">, import("convex/values").VLiteral<"mutation", "required">, import("convex/values").VLiteral<"action", "required">], "optional", never>;
    handler: import("convex/values").VString<string, "required">;
}, "required", "name" | "parameters" | "handler" | "description" | "handlerType" | "parameters.required" | "parameters.type" | "parameters.properties" | `parameters.properties.${string}`>;
/**
 * Format tools for OpenAI/OpenRouter function calling.
 */
export declare function formatToolsForLLM(tools: DatabaseChatTool[]): Array<{
    type: "function";
    function: {
        name: string;
        description: string;
        parameters: ToolParameterSchema;
    };
}>;
/**
 * Find a tool by name.
 */
export declare function findTool(tools: DatabaseChatTool[], name: string): DatabaseChatTool | undefined;
/**
 * Validate tool call arguments against the schema.
 * Returns an error message if invalid, null if valid.
 */
export declare function validateToolArgs(tool: DatabaseChatTool, args: Record<string, unknown>): string | null;
/**
 * Create a generic "query table" tool.
 * This is useful when you want flexible querying without defining many tools.
 */
export declare function createQueryTableTool(allowedTables: string[], handler: string): DatabaseChatTool;
/**
 * Create a generic "count records" tool.
 */
export declare function createCountTool(allowedTables: string[], handler: string): DatabaseChatTool;
/**
 * Create a generic "aggregate" tool for stats.
 */
export declare function createAggregateTool(allowedTables: string[], handler: string): DatabaseChatTool;
/**
 * Create a generic "search" tool using text search.
 */
export declare function createSearchTool(allowedTables: string[], handler: string): DatabaseChatTool;
//# sourceMappingURL=tools.d.ts.map