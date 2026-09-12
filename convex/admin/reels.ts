import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Doc, Id } from "../_generated/dataModel";
import { mutation, query, type QueryCtx } from "../_generated/server";
import { audit, requireStaff } from "../lib/access";
import { localizedOptional } from "../schema";

/** Home-page reels are banners with this placement; the video and poster live in Convex storage. */
export const REEL_PLACEMENT = "home_reel";

async function withUrls(ctx: QueryCtx, b: Doc<"banners">) {
  const media = b.media;
  const url = media?.storageId ? await ctx.storage.getUrl(media.storageId) : (media?.url ?? null);
  const posterUrl = media?.posterStorageId ? await ctx.storage.getUrl(media.posterStorageId) : (media?.posterUrl ?? null);
  return { _id: b._id, order: b.order, isActive: b.isActive, caption: b.title ?? null, href: b.ctaHref ?? null, url, posterUrl, hasPoster: !!media?.posterStorageId };
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireStaff(ctx);
    const rows = await ctx.db.query("banners").withIndex("by_placement", (q) => q.eq("placement", REEL_PLACEMENT)).take(50);
    return Promise.all(rows.map((b) => withUrls(ctx, b)));
  },
});

export const add = mutation({
  args: { storageId: v.id("_storage"), caption: localizedOptional, href: v.optional(v.string()) },
  returns: v.id("banners"),
  handler: async (ctx, { storageId, caption, href }) => {
    const staff = await requireStaff(ctx);
    const meta = await ctx.db.system.get(storageId);
    if (!meta) throw new ConvexError({ code: "NOT_FOUND" });
    if (!meta.contentType?.startsWith("video/")) throw new ConvexError({ code: "INVALID_ARGUMENT", reason: "video expected" });
    const existing = await ctx.db.query("banners").withIndex("by_placement", (q) => q.eq("placement", REEL_PLACEMENT)).take(50);
    const id = await ctx.db.insert("banners", {
      key: `reel_${Date.now()}`,
      placement: REEL_PLACEMENT,
      title: caption,
      ctaHref: href?.trim() || undefined,
      media: { kind: "video", storageId, alt: { en: "Oman Compass Tours reel", ar: "مقطع من جولات بوصلة عُمان" } },
      order: existing.length,
      isActive: true,
    });
    await audit(ctx, staff, "reel.create", "banners", String(id));
    return id;
  },
});

export const update = mutation({
  args: { id: v.id("banners"), caption: localizedOptional, href: v.optional(v.string()), isActive: v.optional(v.boolean()), posterStorageId: v.optional(v.id("_storage")) },
  returns: v.null(),
  handler: async (ctx, { id, caption, href, isActive, posterStorageId }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b || b.placement !== REEL_PLACEMENT) throw new ConvexError({ code: "NOT_FOUND" });
    const patch: Partial<Doc<"banners">> = {};
    if (caption !== undefined) patch.title = caption;
    if (href !== undefined) patch.ctaHref = href.trim() || undefined;
    if (isActive !== undefined) patch.isActive = isActive;
    if (posterStorageId) {
      const meta = await ctx.db.system.get(posterStorageId);
      if (!meta?.contentType?.startsWith("image/")) throw new ConvexError({ code: "INVALID_ARGUMENT", reason: "image expected" });
      if (b.media?.posterStorageId) await ctx.storage.delete(b.media.posterStorageId).catch(() => undefined);
      patch.media = { ...(b.media ?? { kind: "video", alt: { en: "", ar: "" } }), posterStorageId };
    }
    await ctx.db.patch(id, patch);
    await audit(ctx, staff, "reel.update", "banners", String(id));
    return null;
  },
});

export const reorder = mutation({
  args: { orderedIds: v.array(v.id("banners")) },
  returns: v.null(),
  handler: async (ctx, { orderedIds }) => {
    const staff = await requireStaff(ctx);
    for (const [i, id] of orderedIds.entries()) {
      const b = await ctx.db.get(id);
      if (b && b.placement === REEL_PLACEMENT) await ctx.db.patch(id, { order: i });
    }
    await audit(ctx, staff, "reel.reorder", "banners");
    return null;
  },
});

export const remove = mutation({
  args: { id: v.id("banners") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const b = await ctx.db.get(id);
    if (!b || b.placement !== REEL_PLACEMENT) throw new ConvexError({ code: "NOT_FOUND" });
    for (const sid of [b.media?.storageId, b.media?.posterStorageId]) {
      if (sid) await ctx.storage.delete(sid as Id<"_storage">).catch(() => undefined);
    }
    await ctx.db.delete(id);
    await audit(ctx, staff, "reel.delete", "banners", String(id));
    return null;
  },
});
