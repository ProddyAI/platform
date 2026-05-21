import type { DatabaseChatTool } from "./tools";
export type ToolExecutionContext = {
    runQuery: (handler: any, args: Record<string, unknown>) => Promise<unknown>;
    runMutation: (handler: any, args: Record<string, unknown>) => Promise<unknown>;
    runAction: (handler: any, args: Record<string, unknown>) => Promise<unknown>;
};
export declare function mergeToolArgs(parsedArgs: Record<string, unknown>, toolContext?: Record<string, unknown>): Record<string, unknown>;
export declare function executeToolWithContext(ctx: ToolExecutionContext, tool: DatabaseChatTool, parsedArgs: Record<string, unknown>, toolContext?: Record<string, unknown>): Promise<{
    result: unknown;
    args: Record<string, unknown>;
}>;
//# sourceMappingURL=toolExecution.d.ts.map