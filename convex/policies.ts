import { v } from "convex/values";
import { query } from "./_generated/server";

/** All policies with their current version (public). */
export const list = query({
  args: {},
  handler: async (ctx) => {
    const policies = await ctx.db.query("policies").take(50);
    const result = await Promise.all(
      policies
        .sort((a, b) => a.order - b.order)
        .map(async (p) => {
          const version = p.currentVersionId ? await ctx.db.get(p.currentVersionId) : null;
          return {
            _id: p._id,
            key: p.key,
            title: p.title,
            order: p.order,
            requiredAtCheckout: p.requiredAtCheckout,
            version: version ? { _id: version._id, version: version.version, effectiveAt: version.effectiveAt } : null,
          };
        }),
    );
    return result;
  },
});

export const byKey = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const p = await ctx.db.query("policies").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (!p || !p.currentVersionId) return null;
    const version = await ctx.db.get(p.currentVersionId);
    if (!version) return null;
    return {
      _id: p._id,
      key: p.key,
      title: p.title,
      requiredAtCheckout: p.requiredAtCheckout,
      version: { _id: version._id, version: version.version, effectiveAt: version.effectiveAt, body: version.body },
    };
  },
});

/** Current version ids of the policies that must be accepted at checkout. */
export const requiredAtCheckout = query({
  args: {},
  handler: async (ctx) => {
    const policies = await ctx.db.query("policies").take(50);
    return policies
      .filter((p) => p.requiredAtCheckout && p.currentVersionId)
      .sort((a, b) => a.order - b.order)
      .map((p) => ({ key: p.key, title: p.title, versionId: p.currentVersionId! }));
  },
});
