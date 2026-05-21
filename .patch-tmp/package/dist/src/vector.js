/**
 * Vector search helpers for DatabaseChat.
 *
 * These utilities are designed for use inside Convex actions and do not
 * import Convex runtime types. You own your schema, actions, and vector indexes.
 */
/** Default OpenRouter embedding model. */
export const DEFAULT_EMBEDDING_MODEL = "openai/text-embedding-3-small";
/** Default embedding vector dimensions for the default model. */
export const DEFAULT_EMBEDDING_DIMENSIONS = 1536;
/** Alias for the common OpenAI small embedding dimensions. */
export const OPENAI_SMALL_DIMENSIONS = DEFAULT_EMBEDDING_DIMENSIONS;
/**
 * Generate an embedding using OpenRouter's embeddings API.
 */
export async function generateEmbedding(options) {
    if (!options.apiKey) {
        throw new Error("OpenRouter API key is required");
    }
    const headers = {
        Authorization: `Bearer ${options.apiKey}`,
        "Content-Type": "application/json",
    };
    if (options.referer) {
        headers["HTTP-Referer"] = options.referer;
    }
    if (options.title) {
        headers["X-Title"] = options.title;
    }
    const response = await fetch("https://openrouter.ai/api/v1/embeddings", {
        method: "POST",
        headers,
        body: JSON.stringify({
            model: options.model ?? DEFAULT_EMBEDDING_MODEL,
            input: options.text,
        }),
    });
    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenRouter embeddings error: ${response.status} - ${errorText}`);
    }
    let data;
    try {
        data = await response.json();
    }
    catch {
        throw new Error("OpenRouter embeddings response was not valid JSON");
    }
    const embedding = data.data?.[0]?.embedding;
    if (!Array.isArray(embedding) || !embedding.every((v) => typeof v === "number")) {
        throw new Error("OpenRouter embeddings response missing data");
    }
    return embedding;
}
/**
 * Define a vector search tool compatible with DatabaseChat.
 * Sets handlerType to "action" for ctx.vectorSearch compatibility.
 */
export function defineVectorSearchTool(options) {
    const defaultParameters = {
        query: {
            type: "string",
            description: "Semantic search query",
        },
        limit: {
            type: "number",
            description: "Maximum number of results to return",
            optional: true,
        },
    };
    const mergedParameters = {
        ...defaultParameters,
        ...(options.parameters ?? {}),
    };
    const properties = {};
    const required = [];
    for (const [name, config] of Object.entries(mergedParameters)) {
        properties[name] = {
            type: config.type,
            description: config.description,
            enum: config.enum,
            items: config.items,
        };
        if (!config.optional) {
            required.push(name);
        }
    }
    return {
        name: options.name,
        description: options.description,
        handlerType: "action",
        handler: options.handler,
        parameters: {
            type: "object",
            properties,
            required: required.length > 0 ? required : undefined,
        },
    };
}
/**
 * Format vector search results for LLM context.
 *
 * Results without matching documents are skipped.
 */
export function formatVectorResults(results, documents, options = {}) {
    const { includeScore = false, snippetLength = 300, fields } = options;
    const docMap = new Map();
    for (const doc of documents) {
        if (!doc || doc._id === undefined || doc._id === null) {
            continue;
        }
        docMap.set(doc._id, doc);
    }
    const formatted = [];
    const normalizedSnippetLength = Math.max(0, snippetLength);
    for (const result of results) {
        const doc = docMap.get(result._id);
        if (!doc) {
            continue;
        }
        const output = {
            _id: result._id,
        };
        if (includeScore) {
            output._score = result._score;
        }
        const keys = fields !== undefined
            ? [...fields]
            : Object.keys(doc);
        for (const key of keys) {
            if (key === "_id") {
                continue;
            }
            const value = doc[key];
            output[key] = truncateValue(value, normalizedSnippetLength);
        }
        formatted.push(output);
    }
    return formatted;
}
function truncateValue(value, snippetLength) {
    if (typeof value !== "string") {
        return value;
    }
    if (snippetLength <= 0) {
        return "";
    }
    if (value.length <= snippetLength) {
        return value;
    }
    return `${value.slice(0, snippetLength)}...`;
}
