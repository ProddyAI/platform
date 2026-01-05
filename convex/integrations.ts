import {getAuthUserId} from '@convex-dev/auth/server';
import {v} from 'convex/values';

import type {Id} from './_generated/dataModel';
import {mutation, query} from './_generated/server';

// Supported toolkits
const SUPPORTED_TOOLKITS = [
    'github',
    'gmail',
    'slack',
    'linear',
    'notion',
    'clickup'
] as const;

type SupportedToolkit = typeof SUPPORTED_TOOLKITS[number];

// ===== HELPER FUNCTIONS =====

async function getCurrentMember(ctx: any, workspaceId: Id<'workspaces'>) {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error('Unauthorized');

    const member = await ctx.db
        .query('members')
        .withIndex('by_workspace_id_user_id', (q: any) =>
            q.eq('workspaceId', workspaceId).eq('userId', userId)
        )
        .first();

    if (!member) throw new Error('Unauthorized');
    return member;
}

// ===== AUTH CONFIGS =====

// Get auth configs for current member (user-specific)
export const getMyAuthConfigs = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        const member = await getCurrentMember(ctx, args.workspaceId);

        const authConfigs = await ctx.db
            .query('auth_configs')
            .withIndex('by_member_id', (q) =>
                q.eq('memberId', member._id)
            )
            .collect();

        return authConfigs;
    },
});

// Get all auth configs for a workspace (for admin view)
export const getAuthConfigs = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        await getCurrentMember(ctx, args.workspaceId);

        const authConfigs = await ctx.db
            .query('auth_configs')
            .withIndex('by_workspace_id', (q) =>
                q.eq('workspaceId', args.workspaceId)
            )
            .collect();

        return authConfigs;
    },
});

// Get all auth configs for a workspace (public version for API routes)
export const getAuthConfigsPublic = query({
    args: {
        workspaceId: v.id('workspaces'),
        memberId: v.optional(v.id('members')), // Optional: if provided, return only this member's configs
    },
    handler: async (ctx, args) => {
        // Skip authentication check for API routes
        if (args.memberId) {
            // Return only this member's auth configs
            const authConfigs = await ctx.db
                .query('auth_configs')
                .withIndex('by_member_id', (q) =>
                    q.eq('memberId', args.memberId)
                )
                .collect();
            return authConfigs;
        } else {
            // Return all workspace auth configs (backward compatibility)
            const authConfigs = await ctx.db
                .query('auth_configs')
                .withIndex('by_workspace_id', (q) =>
                    q.eq('workspaceId', args.workspaceId)
                )
                .collect();
            return authConfigs;
        }
    },
});

// Get auth config by member and toolkit (user-specific)
export const getMyAuthConfigByToolkit = query({
    args: {
        workspaceId: v.id('workspaces'),
        toolkit: v.union(
            v.literal('github'),
            v.literal('gmail'),
            v.literal('slack'),
            v.literal('linear'),
            v.literal('notion'),
            v.literal('clickup')
        ),
    },
    handler: async (ctx, args) => {
        const member = await getCurrentMember(ctx, args.workspaceId);

        const authConfig = await ctx.db
            .query('auth_configs')
            .withIndex('by_member_toolkit', (q) =>
                q.eq('memberId', member._id).eq('toolkit', args.toolkit)
            )
            .first();

        return authConfig;
    },
});

// Get auth config by workspace and toolkit (for backward compatibility)
export const getAuthConfigByToolkit = query({
    args: {
        workspaceId: v.id('workspaces'),
        toolkit: v.union(
            v.literal('github'),
            v.literal('gmail'),
            v.literal('slack'),
            v.literal('linear'),
            v.literal('notion'),
            v.literal('clickup')
        ),
    },
    handler: async (ctx, args) => {
        await getCurrentMember(ctx, args.workspaceId);

        const authConfig = await ctx.db
            .query('auth_configs')
            .withIndex('by_workspace_toolkit', (q) =>
                q.eq('workspaceId', args.workspaceId).eq('toolkit', args.toolkit)
            )
            .first();

        return authConfig;
    },
});

// Get auth config by ID
export const getAuthConfigById = query({
    args: {
        authConfigId: v.id('auth_configs'),
    },
    handler: async (ctx, args) => {
        return await ctx.db.get(args.authConfigId);
    },
});

// Store auth config in database (now member-specific)
export const storeAuthConfig = mutation({
    args: {
        workspaceId: v.id('workspaces'),
        memberId: v.optional(v.id('members')), // Optional for backward compatibility
        toolkit: v.union(
            v.literal('github'),
            v.literal('gmail'),
            v.literal('slack'),
            v.literal('linear'),
            v.literal('notion'),
            v.literal('clickup')
        ),
        name: v.string(),
        type: v.union(
            v.literal('use_composio_managed_auth'),
            v.literal('use_custom_auth'),
            v.literal('service_connection'),
            v.literal('no_auth')
        ),
        authScheme: v.optional(v.string()),
        composioAuthConfigId: v.string(),
        credentials: v.optional(v.any()),
        isComposioManaged: v.boolean(),
        createdBy: v.id('members'),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const authConfigId = await ctx.db.insert('auth_configs', {
            workspaceId: args.workspaceId,
            memberId: args.memberId,
            toolkit: args.toolkit,
            name: args.name,
            type: args.type,
            authScheme: args.authScheme,
            composioAuthConfigId: args.composioAuthConfigId,
            credentials: args.credentials,
            isComposioManaged: args.isComposioManaged,
            isDisabled: false,
            createdAt: now,
            updatedAt: now,
            createdBy: args.createdBy,
        });

        return authConfigId;
    },
});

// ===== CONNECTED ACCOUNTS =====

// Get connected accounts for current member (user-specific)
export const getMyConnectedAccounts = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        const member = await getCurrentMember(ctx, args.workspaceId);

        const connectedAccounts = await ctx.db
            .query('connected_accounts')
            .withIndex('by_member_id', (q) =>
                q.eq('memberId', member._id)
            )
            .collect();

        return connectedAccounts;
    },
});

// Get all connected accounts for a workspace (for admin view)
export const getConnectedAccounts = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        await getCurrentMember(ctx, args.workspaceId);

        const connectedAccounts = await ctx.db
            .query('connected_accounts')
            .withIndex('by_workspace_id', (q) =>
                q.eq('workspaceId', args.workspaceId)
            )
            .collect();

        return connectedAccounts;
    },
});

// Get all connected accounts for a workspace (public version for API routes)
export const getConnectedAccountsPublic = query({
    args: {
        workspaceId: v.id('workspaces'),
        memberId: v.optional(v.id('members')), // Optional: if provided, return only this member's accounts
    },
    handler: async (ctx, args) => {
        // Skip authentication check for API routes
        if (args.memberId) {
            // Return only this member's connected accounts
            const connectedAccounts = await ctx.db
                .query('connected_accounts')
                .withIndex('by_member_id', (q) =>
                    q.eq('memberId', args.memberId!)
                )
                .collect();
            return connectedAccounts;
        } else {
            // Return all workspace connected accounts (backward compatibility)
            const connectedAccounts = await ctx.db
                .query('connected_accounts')
                .withIndex('by_workspace_id', (q) =>
                    q.eq('workspaceId', args.workspaceId)
                )
                .collect();
            return connectedAccounts;
        }
    },
});

// Get connected account by member and toolkit (user-specific)
export const getMyConnectedAccountByToolkit = query({
    args: {
        workspaceId: v.id('workspaces'),
        toolkit: v.string(),
    },
    handler: async (ctx, args) => {
        const member = await getCurrentMember(ctx, args.workspaceId);

        return await ctx.db
            .query('connected_accounts')
            .withIndex('by_member_toolkit', (q) =>
                q.eq('memberId', member._id).eq('toolkit', args.toolkit)
            )
            .first();
    },
});

// Get connected account by user and toolkit (for backward compatibility)
export const getConnectedAccountByUserAndToolkit = query({
    args: {
        workspaceId: v.id('workspaces'),
        userId: v.string(),
        toolkit: v.string(),
    },
    handler: async (ctx, args) => {
        await getCurrentMember(ctx, args.workspaceId);

        return await ctx.db
            .query('connected_accounts')
            .withIndex('by_workspace_id', (q) =>
                q.eq('workspaceId', args.workspaceId)
            )
            .filter((q) =>
                q.and(
                    q.eq(q.field('userId'), args.userId),
                    q.eq(q.field('toolkit'), args.toolkit)
                )
            )
            .first();
    },
});

// Store connected account in database (now member-specific)
export const storeConnectedAccount = mutation({
    args: {
        workspaceId: v.id('workspaces'),
        memberId: v.optional(v.id('members')), // Optional for backward compatibility
        authConfigId: v.id('auth_configs'),
        userId: v.string(),
        composioAccountId: v.string(),
        toolkit: v.string(),
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
        connectedBy: v.id('members'),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const connectedAccountId = await ctx.db.insert('connected_accounts', {
            workspaceId: args.workspaceId,
            memberId: args.memberId,
            authConfigId: args.authConfigId,
            userId: args.userId,
            composioAccountId: args.composioAccountId,
            toolkit: args.toolkit,
            status: args.status,
            statusReason: args.statusReason,
            metadata: args.metadata,
            testRequestEndpoint: args.testRequestEndpoint,
            isDisabled: false,
            connectedAt: now,
            lastUsed: now,
            connectedBy: args.connectedBy,
        });

        return connectedAccountId;
    },
});

// Update connected account status
export const updateConnectedAccountStatus = mutation({
    args: {
        connectedAccountId: v.id('connected_accounts'),
        status: v.union(
            v.literal('ACTIVE'),
            v.literal('PENDING'),
            v.literal('EXPIRED'),
            v.literal('ERROR'),
            v.literal('DISABLED')
        ),
        isDisabled: v.optional(v.boolean()),
        lastUsed: v.optional(v.number()),
    },
    handler: async (ctx, args) => {
        const updateData: any = {
            status: args.status,
        };

        if (args.isDisabled !== undefined) {
            updateData.isDisabled = args.isDisabled;
        }

        if (args.lastUsed !== undefined) {
            updateData.lastUsed = args.lastUsed;
        }

        await ctx.db.patch(args.connectedAccountId, updateData);
    },
});

// Delete connected account (for user-specific disconnection)
export const deleteConnectedAccount = mutation({
    args: {
        connectedAccountId: v.id('connected_accounts'),
        memberId: v.id('members'), // Ensure the account belongs to this member
    },
    handler: async (ctx, args) => {
        // Verify the connected account belongs to this member
        const connectedAccount = await ctx.db.get(args.connectedAccountId);
        
        if (!connectedAccount) {
            throw new Error('Connected account not found');
        }

        // Log legacy records without memberId for visibility
        if (!connectedAccount.memberId) {
            console.warn(
                `Attempted to delete legacy connected account ${args.connectedAccountId} without memberId. ` +
                'Use adminDeleteConnectedAccount for legacy records.'
            );
            throw new Error('Unauthorized: Cannot delete a connected account without an owner. Contact admin.');
        }

        if (connectedAccount.memberId !== args.memberId) {
            throw new Error('Unauthorized: Cannot delete another member\'s connection');
        }

        // Delete the connected account from database
        await ctx.db.delete(args.connectedAccountId);
    },
});

// Admin-only mutation to delete legacy connected accounts without memberId
export const adminDeleteConnectedAccount = mutation({
    args: {
        connectedAccountId: v.id('connected_accounts'),
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        // Verify the caller has admin privileges in the workspace
        const userId = await getAuthUserId(ctx);
        if (!userId) throw new Error('Unauthorized');

        // Get the caller's member record in this workspace
        const callerMember = await ctx.db
            .query('members')
            .withIndex('by_workspace_id_user_id', (q) =>
                q.eq('workspaceId', args.workspaceId).eq('userId', userId)
            )
            .first();

        if (!callerMember || (callerMember.role !== 'admin' && callerMember.role !== 'owner')) {
            throw new Error('Unauthorized: Admin or owner privileges required');
        }

        const connectedAccount = await ctx.db.get(args.connectedAccountId);
        if (!connectedAccount) {
            throw new Error('Connected account not found');
        }

        // Verify the connected account belongs to the same workspace
        if (connectedAccount.workspaceId !== args.workspaceId) {
            throw new Error('Connected account does not belong to this workspace');
        }

        // Log the deletion for audit purposes
        console.log(
            `Admin ${userId} (member ${callerMember._id}) deleting connected account ${args.connectedAccountId} ` +
            `(toolkit: ${connectedAccount.toolkit}, has memberId: ${!!connectedAccount.memberId})`
        );

        // Delete the connected account from database
        await ctx.db.delete(args.connectedAccountId);
    },
});

// ===== MCP SERVERS =====

// Get MCP servers for workspace
export const getMCPServers = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        await getCurrentMember(ctx, args.workspaceId);

        const mcpServers = await ctx.db
            .query('mcp_servers')
            .withIndex('by_workspace_id', (q) =>
                q.eq('workspaceId', args.workspaceId)
            )
            .collect();

        return mcpServers;
    },
});

// Get MCP servers for workspace (public version for API routes)
export const getMCPServersPublic = query({
    args: {
        workspaceId: v.id('workspaces'),
    },
    handler: async (ctx, args) => {
        // Skip authentication check for API routes
        const mcpServers = await ctx.db
            .query('mcp_servers')
            .withIndex('by_workspace_id', (q) =>
                q.eq('workspaceId', args.workspaceId)
            )
            .collect();

        return mcpServers;
    },
});

// Store MCP server in database
export const storeMCPServer = mutation({
    args: {
        workspaceId: v.id('workspaces'),
        name: v.string(),
        composioServerId: v.string(),
        toolkitConfigs: v.array(v.object({
            toolkit: v.string(),
            authConfigId: v.string(),
            allowedTools: v.array(v.string()),
        })),
        useComposioManagedAuth: v.boolean(),
        createdBy: v.id('members'),
    },
    handler: async (ctx, args) => {
        const now = Date.now();

        const mcpServerId = await ctx.db.insert('mcp_servers', {
            workspaceId: args.workspaceId,
            name: args.name,
            composioServerId: args.composioServerId,
            toolkitConfigs: args.toolkitConfigs,
            useComposioManagedAuth: args.useComposioManagedAuth,
            serverUrls: undefined,
            isActive: true,
            createdAt: now,
            updatedAt: now,
            createdBy: args.createdBy,
        });

        return mcpServerId;
    },
});
