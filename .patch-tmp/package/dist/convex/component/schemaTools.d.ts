/**
 * Schema introspection for auto-generating tools.
 *
 * Automatically creates query tools from your Convex schema.
 *
 * @example
 * ```typescript
 * import schema from "./schema";
 * import { generateToolsFromSchema } from "./schemaTools";
 *
 * const tools = generateToolsFromSchema({
 *   schema,
 *   allowedTables: ["applications", "jobs"],
 *   excludeFields: { applications: ["ssn"] },
 *   handlers: {
 *     query: queryHandleString,
 *     count: countHandleString,
 *     aggregate: aggregateHandleString,
 *   }
 * });
 * ```
 */
import type { DatabaseChatTool, AutoToolsConfig } from "./tools";
/**
 * Simplified schema info extracted from Convex schema.
 */
export interface TableInfo {
    name: string;
    fields: FieldInfo[];
    indexes: IndexInfo[];
    searchIndexes: SearchIndexInfo[];
}
export interface FieldInfo {
    name: string;
    type: "string" | "number" | "boolean" | "array" | "object" | "id" | "unknown";
    optional: boolean;
    description?: string;
}
export interface IndexInfo {
    name: string;
    fields: string[];
}
export interface SearchIndexInfo {
    name: string;
    searchField: string;
    filterFields: string[];
}
/**
 * Handler function strings for generated tools.
 */
export interface SchemaToolHandlers {
    /** Handler for queryTable tool */
    query: string;
    /** Handler for countRecords tool */
    count: string;
    /** Handler for aggregate tool (optional) */
    aggregate?: string;
    /** Handler for searchRecords tool (optional) */
    search?: string;
    /** Handler for getById tool (optional) */
    getById?: string;
}
export interface GenerateToolsOptions extends AutoToolsConfig {
    /** Table information (extracted from schema) */
    tables: TableInfo[];
    /** Function handle strings for each tool type */
    handlers: SchemaToolHandlers;
}
/**
 * Extract table info from schema definition.
 * Note: This is a simplified extraction - full schema parsing would need
 * access to the actual validator internals.
 */
export declare function extractTableInfo(tableName: string, tableDefinition: unknown, config: Pick<AutoToolsConfig, "excludeFields" | "fieldDescriptions">): TableInfo;
/**
 * Generate tools from schema configuration.
 */
export declare function generateToolsFromSchema(options: GenerateToolsOptions): DatabaseChatTool[];
/**
 * Helper to create a simple table info for manual configuration.
 * Use this when you want auto-tools but don't want to parse the full schema.
 */
export declare function defineTable(name: string, fields: Array<{
    name: string;
    type: FieldInfo["type"];
    optional?: boolean;
    description?: string;
}>, options?: {
    searchIndex?: {
        field: string;
        filterFields?: string[];
    };
}): TableInfo;
//# sourceMappingURL=schemaTools.d.ts.map