import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { mutation, query } from "../_generated/server";
import { assertString, audit, requireStaff } from "../lib/access";
import { localized, localizedOptional, mediaValidator, seoValidator } from "../schema";

const slugify = (s: string) => s.trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/* Banners (home hero, promos) */
export const banners = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return await ctx.db.query("banners").take(100); },
});

export const upsertBanner = mutation({
  args: { id: v.optional(v.id("banners")), key: v.string(), placement: v.string(), title: localizedOptional, subtitle: localizedOptional, ctaLabel: localizedOptional, ctaHref: v.optional(v.string()), media: v.optional(mediaValidator), countdownTo: v.optional(v.number()), order: v.number(), startsAt: v.optional(v.number()), endsAt: v.optional(v.number()), isActive: v.boolean() },
  returns: v.id("banners"),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const { id, ...doc } = args;
    if (id) { await ctx.db.patch(id, doc); await audit(ctx, staff, "banner.update", "banners", String(id)); return id; }
    const newId = await ctx.db.insert("banners", doc);
    await audit(ctx, staff, "banner.create", "banners", String(newId));
    return newId;
  },
});

export const removeBanner = mutation({
  args: { id: v.id("banners") },
  returns: v.null(),
  handler: async (ctx, { id }) => { const staff = await requireStaff(ctx); await ctx.db.delete(id); await audit(ctx, staff, "banner.delete", "banners", String(id)); return null; },
});

/* Blog */
export const posts = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return (await ctx.db.query("blogPosts").take(300)).sort((a, b) => b.updatedAt - a.updatedAt); },
});

export const upsertPost = mutation({
  args: { id: v.optional(v.id("blogPosts")), title: localized, slug: localizedOptional, excerpt: localized, body: localized, cover: v.optional(mediaValidator), category: v.string(), tags: v.array(v.string()), authorName: v.string(), status: v.union(v.literal("draft"), v.literal("published")), publishedAt: v.optional(v.number()), seo: v.optional(seoValidator) },
  returns: v.id("blogPosts"),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const words = (args.body.en + " " + args.body.ar).split(/\s+/).length;
    const { id, ...rest } = args;
    const doc = { ...rest, slug: { en: slugify(args.slug?.en || args.title.en), ar: slugify(args.slug?.ar || args.title.ar) }, readingMinutes: Math.max(1, Math.round(words / 2 / 200)), authorId: staff._id, publishedAt: args.status === "published" ? (args.publishedAt ?? Date.now()) : args.publishedAt, updatedAt: Date.now() };
    if (id) { await ctx.db.patch(id, doc); await audit(ctx, staff, "post.update", "blogPosts", String(id)); return id; }
    const newId = await ctx.db.insert("blogPosts", doc);
    await audit(ctx, staff, "post.create", "blogPosts", String(newId));
    return newId;
  },
});

export const removePost = mutation({
  args: { id: v.id("blogPosts") },
  returns: v.null(),
  handler: async (ctx, { id }) => { const staff = await requireStaff(ctx); await ctx.db.delete(id); await audit(ctx, staff, "post.delete", "blogPosts", String(id)); return null; },
});

/* Team */
export const team = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return await ctx.db.query("teamMembers").withIndex("by_order").take(50); },
});

export const upsertTeamMember = mutation({
  args: { id: v.optional(v.id("teamMembers")), name: localized, roleTitle: localized, bio: localized, photo: v.optional(mediaValidator), languages: v.array(v.string()), order: v.number(), isActive: v.boolean() },
  returns: v.id("teamMembers"),
  handler: async (ctx, args) => {
    await requireStaff(ctx);
    const { id, ...doc } = args;
    if (id) { await ctx.db.patch(id, doc); return id; }
    return await ctx.db.insert("teamMembers", doc);
  },
});

export const removeTeamMember = mutation({
  args: { id: v.id("teamMembers") },
  returns: v.null(),
  handler: async (ctx, { id }) => { await requireStaff(ctx); await ctx.db.delete(id); return null; },
});

/* Coupons / promotions */
export const coupons = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return await ctx.db.query("coupons").take(200); },
});

export const upsertCoupon = mutation({
  args: { id: v.optional(v.id("coupons")), code: v.string(), name: localized, type: v.union(v.literal("percent"), v.literal("fixed")), value: v.number(), minSubtotalOmr: v.optional(v.number()), maxDiscountOmr: v.optional(v.number()), tourIds: v.optional(v.array(v.id("tours"))), startsAt: v.optional(v.number()), endsAt: v.optional(v.number()), usageLimit: v.optional(v.number()), minGroupSize: v.optional(v.number()), earlyBirdDays: v.optional(v.number()), isActive: v.boolean() },
  returns: v.id("coupons"),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const code = args.code.trim().toUpperCase();
    if (!/^[A-Z0-9_-]{3,24}$/.test(code)) throw new ConvexError({ code: "INVALID_CODE" });
    if (args.type === "percent" && (args.value <= 0 || args.value > 100)) throw new ConvexError({ code: "INVALID_VALUE" });
    if (args.type === "fixed" && args.value <= 0) throw new ConvexError({ code: "INVALID_VALUE" });
    const clash = await ctx.db.query("coupons").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (clash && clash._id !== args.id) throw new ConvexError({ code: "CODE_TAKEN" });
    const doc = { code, name: args.name, type: args.type, value: args.type === "fixed" ? Math.round(args.value * 1000) : Math.round(args.value), minSubtotal: args.minSubtotalOmr ? Math.round(args.minSubtotalOmr * 1000) : undefined, maxDiscount: args.maxDiscountOmr ? Math.round(args.maxDiscountOmr * 1000) : undefined, tourIds: args.tourIds, startsAt: args.startsAt, endsAt: args.endsAt, usageLimit: args.usageLimit, minGroupSize: args.minGroupSize, earlyBirdDays: args.earlyBirdDays, isActive: args.isActive, usedCount: clash?.usedCount ?? 0 };
    if (args.id) { await ctx.db.patch(args.id, doc); await audit(ctx, staff, "coupon.update", "coupons", String(args.id), undefined, { code }); return args.id; }
    const id = await ctx.db.insert("coupons", doc);
    await audit(ctx, staff, "coupon.create", "coupons", String(id), undefined, { code });
    return id;
  },
});

export const removeCoupon = mutation({
  args: { id: v.id("coupons") },
  returns: v.null(),
  handler: async (ctx, { id }) => { const staff = await requireStaff(ctx); await ctx.db.delete(id); await audit(ctx, staff, "coupon.delete", "coupons", String(id)); return null; },
});

/* Newsletter */
export const subscribers = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return (await ctx.db.query("newsletterSubscribers").take(5000)).map((s) => ({ _id: s._id, email: s.email, locale: s.locale, source: s.source ?? null, subscribedAt: s._creationTime, unsubscribedAt: s.unsubscribedAt ?? null })); },
});

/* SEO metadata per page */
export const seo = query({
  args: {},
  handler: async (ctx) => { await requireStaff(ctx); return await ctx.db.query("seoMeta").take(200); },
});

export const upsertSeo = mutation({
  args: { path: v.string(), seo: seoValidator },
  returns: v.null(),
  handler: async (ctx, { path, seo }) => {
    await requireStaff(ctx);
    const p = assertString(path, 200, "path", 1);
    const existing = await ctx.db.query("seoMeta").withIndex("by_path", (q) => q.eq("path", p)).unique();
    if (existing) await ctx.db.patch(existing._id, { seo, updatedAt: Date.now() });
    else await ctx.db.insert("seoMeta", { path: p, seo, updatedAt: Date.now() });
    return null;
  },
});
