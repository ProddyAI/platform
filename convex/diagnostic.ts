import { v } from "convex/values";
import { query, mutation } from "./_generated/server";
import { getAuthUserId } from "@convex-dev/auth/server";

export const checkNotes = query({
  args: {},
  handler: async (ctx) => {
    const allNotes = await ctx.db.query("notes").collect();
    return allNotes.map(n => ({
      id: n._id,
      title: n.title,
      workspaceId: n.workspaceId,
      channelId: n.channelId
    }));
  }
});

export const checkWorkspaces = query({
  args: {},
  handler: async (ctx) => {
    const workspaces = await ctx.db.query("workspaces").collect();
    return workspaces.map(w => ({
      id: w._id,
      name: w.name,
      slug: (w as any).slug
    }));
  }
});

export const checkMembers = query({
  args: {},
  handler: async (ctx) => {
    const members = await ctx.db.query("members").collect();
    return members.map(m => ({
      id: m._id,
      userId: m.userId,
      workspaceId: m.workspaceId,
      role: m.role
    }));
  }
});

export const checkCurrentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    return userId || "NOT_LOGGED_IN";
  }
});
export const checkUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map(u => ({
      id: u._id,
      name: u.name,
      email: u.email
    }));
  }
});
export const fixNoteIds = mutation({
  args: {},
  handler: async (ctx) => {
    const typoId = "r57b3dwhxc4kb1dkjt6zw6an85pq2m";
    const correctId = "r57b3dwhxc4kb1dkjt6tz6w6an85pq2m";
    
    const notes = await ctx.db
      .query("notes")
      .filter((q) => q.eq(q.field("workspaceId"), typoId as any))
      .collect();
    
    let count = 0;
    for (const note of notes) {
      await ctx.db.patch(note._id, { workspaceId: correctId as any });
      count++;
    }
    
    return `Migrated ${count} notes from zw6 to tz6`;
  }
});
