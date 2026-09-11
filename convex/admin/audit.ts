import { v } from "convex/values";
import { query } from "../_generated/server";
import { requireStaff } from "../lib/access";

export const list = query({
  args: { entityType: v.optional(v.string()), actorId: v.optional(v.id("users")), limit: v.optional(v.number()) },
  handler: async (ctx, { entityType, actorId, limit }) => {
    await requireStaff(ctx);
    const n = Math.min(limit ?? 200, 1000);
    const rows = actorId
      ? await ctx.db.query("auditLogs").withIndex("by_actor", (q) => q.eq("actorId", actorId)).order("desc").take(n)
      : await ctx.db.query("auditLogs").withIndex("by_createdAt").order("desc").take(n);
    return rows.filter((r) => !entityType || r.entityType === entityType);
  },
});

export const notifications = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireStaff(ctx);
    return await ctx.db.query("notifications").order("desc").take(Math.min(limit ?? 200, 1000));
  },
});

export const dataRequests = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("dataRequests").order("desc").take(200);
    return Promise.all(rows.map(async (r) => { const u = await ctx.db.get(r.userId); return { ...r, userEmail: u?.email ?? null, userName: u?.name ?? null }; }));
  },
});
