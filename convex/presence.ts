import { getAuthUserId } from '@convex-dev/auth/server';
import { mutation, query } from "./_generated/server";
import { components } from "./_generated/api";
import { v } from "convex/values";
import { Presence } from "@convex-dev/presence";

export const presence = new Presence(components.presence);

export const heartbeat = mutation({
  args: {
    roomId: v.string(),
    userId: v.string(),
    sessionId: v.string(),
    interval: v.number()
  },
  handler: async (ctx, { roomId, userId, sessionId, interval }) => {
    // Check authentication
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      throw new Error('Unauthorized');
    }

    // Use the authenticated user ID instead of the passed userId for security
    const actualUserId = authUserId;

    // Check if user has status tracking enabled
    const userPrefs = await ctx.db
      .query('preferences')
      .withIndex('by_user_id', (q) => q.eq('userId', actualUserId))
      .unique();

    const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

    // If status tracking is disabled, return the expected format
    if (!statusTrackingEnabled) {
      // Return a dummy session token for compatibility
      return { roomToken: roomId, sessionToken: sessionId };
    }

    return await presence.heartbeat(ctx, roomId, actualUserId, sessionId, interval);
  },
});

export const list = query({
  args: { roomToken: v.string() },
  handler: async (ctx, { roomToken }) => {
    // Avoid adding per-user reads so all subscriptions can share same cache.
    return await presence.list(ctx, roomToken);
  },
});

export const disconnect = mutation({
  args: { sessionToken: v.string() },
  handler: async (ctx, { sessionToken }) => {
    // Can't check auth here because it's called over http from sendBeacon.
    return await presence.disconnect(ctx, sessionToken);
  },
});

// Additional helper functions for workspace-level presence

export const listWorkspacePresence = query({
  args: { workspaceId: v.id('workspaces') },
  handler: async (ctx, { workspaceId }) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      return [];
    }

    // Check if user is a member of the workspace
    const member = await ctx.db
      .query('members')
      .withIndex('by_workspace_id_user_id', (q) =>
        q.eq('workspaceId', workspaceId).eq('userId', authUserId)
      )
      .unique();

    if (!member) {
      return [];
    }

    // Get presence for the workspace room
    const roomToken = `workspace-${workspaceId}`;
    return await presence.list(ctx, roomToken);
  },
});

export const listUserPresence = query({
  args: { userId: v.id('users') },
  handler: async (ctx, { userId }) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      return [];
    }

    // Check if user has status tracking enabled
    const userPrefs = await ctx.db
      .query('preferences')
      .withIndex('by_user_id', (q) => q.eq('userId', userId))
      .unique();

    const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;

    if (!statusTrackingEnabled) {
      return [];
    }

    return await presence.listUser(ctx, userId);
  },
});

// Workspace heartbeat for general workspace presence
export const workspaceHeartbeat = mutation({
  args: {
    workspaceId: v.id('workspaces'),
    sessionId: v.string(),
    interval: v.number()
  },
  handler: async (ctx, { workspaceId, sessionId, interval }) => {
    const authUserId = await getAuthUserId(ctx);
    if (!authUserId) {
      // If the client is not authenticated (expired session, anonymous user, etc.),
      // do not crash the mutation. We simply skip presence tracking.
      // Return the expected format for compatibility with callers.
      return { roomToken: `workspace-${workspaceId}`, sessionToken: sessionId };
    }

    // Check if user is a member of the workspace
    const member = await ctx.db
      .query('members')
      .withIndex('by_workspace_id_user_id', (q) =>
        q.eq('workspaceId', workspaceId).eq('userId', authUserId)
      )
      .unique();

    if (!member) {
      throw new Error('Not a member of this workspace');
    }

    // Check if user has status tracking enabled
    const userPrefs = await ctx.db
      .query('preferences')
      .withIndex('by_user_id', (q) => q.eq('userId', authUserId))
      .unique();

    const statusTrackingEnabled = userPrefs?.settings?.statusTracking ?? true;
    const roomId = `workspace-${workspaceId}`;

    if (!statusTrackingEnabled) {
      // Return the expected format for compatibility
      return { roomToken: roomId, sessionToken: sessionId };
    }

    return await presence.heartbeat(ctx, roomId, authUserId, sessionId, interval);
  },
});
