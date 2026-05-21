/**
 * Vector search helpers for DatabaseChat.
 *
 * These utilities are designed for use inside Convex actions and do not
 * import Convex runtime types. You own your schema, actions, and vector indexes.
 */
/** Default OpenRouter embedding model. */
export declare const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Default embedding vector dimensions for the default model. */
export declare const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
/** Alias for the common OpenAI small embedding dimensions. */
export declare const OPENAI_SMALL_DIMENSIONS = 1536;
export type ToolParameterType = "string" | "number" | "boolean" | "array" | "object";
export interface ToolParameterSchema {
    type: "object";
    properties: Record<string, {
        type: ToolParameterType;
        description?: string;
        enum?: string[];
        items?: {
            type: ToolParameterType;
        };
    }>;
    required?: string[];
}
/**
 * A vector search result from ctx.vectorSearch.
 */
export type VectorSearchResult<IdType = string> = {
    _id: IdType;
    _score: number;
};
/**
 * Tool definition compatible with DatabaseChat tools.
 */
export interface VectorToolDefinition {
    /** Unique name for the tool (used by the LLM to call it). */
    name: string;
    /** Human-readable description of what the tool does. */
    description: string;
    /** JSON Schema describing parameters. */
    parameters: ToolParameterSchema;
    /** Function type for the handler (default: "query"). */
    handlerType?: "query" | "mutation" | "action";
    /** Convex function handle string to execute. */
    handler: string;
}
/**
 * Options for generateEmbedding.
 */
export interface GenerateEmbeddingOptions {
    /** OpenRouter API key. */
    apiKey: string;
    /** Text to embed. */
    text: string;
    /** Embedding model ID (OpenRouter). */
    model?: string;
    /** Optional HTTP-Referer header for OpenRouter analytics. */
    referer?: string;
    /** Optional X-Title header for OpenRouter analytics. */
    title?: string;
}
/**
 * Options for defineVectorSearchTool.
 */
export interface DefineVectorSearchToolOptions {
    name: string;
    description: string;
    /** Name of the Convex action to call. */
    handler: string;
    /** Tool parameters. Defaults include query and optional limit. */
    parameters?: Record<string, {
        type: ToolParameterType;
        description: string;
        optional?: boolean;
        enum?: string[];
        items?: {
            type: ToolParameterType;
        };
    }>;
}
/**
 * Options for formatVectorResults.
 */
export interface FormatOptions<Fields extends readonly string[] | undefined = undefined> {
    /** Include similarity score in each result. */
    includeScore?: boolean;
    /** Maximum length of string fields before truncation. */
    snippetLength?: number;
    /** Specific fields to include from each document. */
    fields?: Fields;
}
/**
 * Formatted vector result ready for LLM context.
 */
export type FormattedVectorResult<TDoc extends Record<string, unknown>, IdType = string, Fields extends readonly (keyof TDoc & string)[] | undefined = undefined> = {
    _id: IdType;
    _score?: number;
} & (Fields extends readonly (keyof TDoc & string)[] ? Pick<TDoc, Fields[number]> : TDoc);
/**
 * Generate an embedding using OpenRouter's embeddings API.
 */
export declare function generateEmbedding(options: GenerateEmbeddingOptions): Promise<number[]>;
/**
 * Define a vector search tool compatible with DatabaseChat.
 * Sets handlerType to "action" for ctx.vectorSearch compatibility.
 */
export declare function defineVectorSearchTool(options: DefineVectorSearchToolOptions): VectorToolDefinition;
/**
 * Format vector search results for LLM context.
 *
 * Results without matching documents are skipped.
 */
export declare function formatVectorResults<TDoc extends Record<string, unknown>, IdType = string, Fields extends readonly (keyof TDoc & string)[] | undefined = undefined>(results: Array<VectorSearchResult<IdType>>, documents: Array<(TDoc & {
    _id?: IdType;
}) | null | undefined>, options?: FormatOptions<Fields>): Array<FormattedVectorResult<TDoc, IdType, Fields>>;
//# sourceMappingURL=vector.d.ts.map