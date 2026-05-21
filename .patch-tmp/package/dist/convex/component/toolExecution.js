export function mergeToolArgs(parsedArgs, toolContext) {
    if (!toolContext || Object.keys(toolContext).length === 0) {
        return { ...parsedArgs };
    }
    return { ...parsedArgs, ...toolContext };
}
export async function executeToolWithContext(ctx, tool, parsedArgs, toolContext) {
    const mergedArgs = mergeToolArgs(parsedArgs, toolContext);
    const result = await executeToolHandler(ctx, tool, mergedArgs);
    return { result, args: mergedArgs };
}
async function executeToolHandler(ctx, tool, args) {
    const handlerType = tool.handlerType ?? "query";
    switch (handlerType) {
        case "mutation":
            return await ctx.runMutation(tool.handler, args);
        case "action":
            return await ctx.runAction(tool.handler, args);
        case "query":
        default:
            return await ctx.runQuery(tool.handler, args);
    }
}
