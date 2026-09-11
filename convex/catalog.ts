import { v } from "convex/values";
import { query } from "./_generated/server";

export const categories = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("categories").withIndex("by_order").take(50);
    const tours = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(500);
    return rows
      .filter((c) => c.isActive)
      .map((c) => ({
        _id: c._id,
        key: c.key,
        name: c.name,
        slug: c.slug,
        description: c.description ?? null,
        icon: c.icon ?? null,
        count: tours.filter((t) => t.categoryId === c._id || (t.secondaryCategoryIds ?? []).includes(c._id)).length,
      }));
  },
});

export const destinations = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("destinations").withIndex("by_order").take(50);
    const tours = await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(500);
    return rows
      .filter((d) => d.isActive)
      .map((d) => ({
        _id: d._id,
        key: d.key,
        name: d.name,
        slug: d.slug,
        tagline: d.tagline ?? null,
        description: d.description ?? null,
        region: d.region ?? null,
        image: d.image ?? null,
        lat: d.lat ?? null,
        lng: d.lng ?? null,
        count: tours.filter((t) => t.destinationIds.includes(d._id)).length,
      }));
  },
});

export const destinationBySlug = query({
  args: { slug: v.string(), locale: v.union(v.literal("en"), v.literal("ar")) },
  handler: async (ctx, { slug, locale }) => {
    const d =
      (locale === "ar"
        ? await ctx.db.query("destinations").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug)).unique()
        : await ctx.db.query("destinations").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique()) ??
      (await ctx.db.query("destinations").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique());
    if (!d || !d.isActive) return null;
    return d;
  },
});
