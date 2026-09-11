import { v } from "convex/values";
import { query } from "./_generated/server";
import { localeValidator } from "./schema";

export const list = query({
  args: { category: v.optional(v.string()), limit: v.optional(v.number()) },
  handler: async (ctx, { category, limit }) => {
    const rows = await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .take(Math.min(limit ?? 24, 100));
    return rows
      .filter((p) => !category || p.category === category)
      .map((p) => ({
        _id: p._id,
        title: p.title,
        slug: p.slug,
        excerpt: p.excerpt,
        cover: p.cover ?? null,
        category: p.category,
        tags: p.tags,
        authorName: p.authorName,
        readingMinutes: p.readingMinutes,
        publishedAt: p.publishedAt ?? p._creationTime,
      }));
  },
});

export const bySlug = query({
  args: { slug: v.string(), locale: localeValidator },
  handler: async (ctx, { slug, locale }) => {
    const post =
      (locale === "ar"
        ? await ctx.db.query("blogPosts").withIndex("by_slug_ar", (q) => q.eq("slug.ar", slug)).unique()
        : await ctx.db.query("blogPosts").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique()) ??
      (await ctx.db.query("blogPosts").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique());
    if (!post || post.status !== "published") return null;
    const more = (
      await ctx.db.query("blogPosts").withIndex("by_status", (q) => q.eq("status", "published")).order("desc").take(6)
    )
      .filter((p) => p._id !== post._id)
      .slice(0, 3)
      .map((p) => ({ _id: p._id, title: p.title, slug: p.slug, excerpt: p.excerpt, cover: p.cover ?? null, readingMinutes: p.readingMinutes, publishedAt: p.publishedAt ?? p._creationTime }));
    return { ...post, publishedAt: post.publishedAt ?? post._creationTime, more };
  },
});
