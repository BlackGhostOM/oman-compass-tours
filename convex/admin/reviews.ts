import { v } from "convex/values";
import { ConvexError } from "convex/values";
import type { Id } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { assertInt, assertString, audit, requireStaff } from "../lib/access";
import { localeValidator } from "../schema";

const statusValidator = v.union(v.literal("pending"), v.literal("approved"), v.literal("rejected"));

async function recomputeTourRating(ctx: MutationCtx, tourId: Id<"tours">) {
  const rows = await ctx.db.query("reviews").withIndex("by_tour", (q) => q.eq("tourId", tourId).eq("status", "approved")).take(1000);
  const count = rows.length;
  const avg = count ? rows.reduce((a, r) => a + r.rating, 0) / count : 0;
  await ctx.db.patch(tourId, { ratingCount: count, ratingAverage: count ? Math.round(avg * 10) / 10 : 5 });
}

export const list = query({
  args: { status: v.optional(statusValidator) },
  handler: async (ctx, { status }) => {
    await requireStaff(ctx);
    const rows = status ? await ctx.db.query("reviews").withIndex("by_status", (q) => q.eq("status", status)).order("desc").take(300) : await ctx.db.query("reviews").order("desc").take(300);
    return Promise.all(rows.map(async (r) => ({ ...r, tourTitle: r.tourId ? (await ctx.db.get(r.tourId))?.title ?? null : null })));
  },
});

export const moderate = mutation({
  args: { id: v.id("reviews"), status: v.optional(statusValidator), isFeatured: v.optional(v.boolean()), staffReply: v.optional(v.string()) },
  returns: v.null(),
  handler: async (ctx, { id, status, isFeatured, staffReply }) => {
    const staff = await requireStaff(ctx);
    const r = await ctx.db.get(id);
    if (!r) throw new ConvexError({ code: "NOT_FOUND" });
    const patch: Record<string, unknown> = { moderatedBy: staff._id };
    if (status) patch.status = status;
    if (isFeatured !== undefined) patch.isFeatured = isFeatured;
    if (staffReply !== undefined) { patch.staffReply = assertString(staffReply, 2000, "reply"); patch.staffReplyAt = Date.now(); }
    await ctx.db.patch(id, patch);
    if (r.tourId && status) await recomputeTourRating(ctx, r.tourId);
    await audit(ctx, staff, "review.moderate", "reviews", String(id), { status: r.status, isFeatured: r.isFeatured }, patch);
    return null;
  },
});

/** Import an external review (Tripadvisor / Viator / Google) manually. */
export const importExternal = mutation({
  args: { tourId: v.optional(v.id("tours")), authorName: v.string(), authorCountry: v.optional(v.string()), rating: v.number(), title: v.optional(v.string()), body: v.string(), language: localeValidator, source: v.union(v.literal("tripadvisor"), v.literal("viator"), v.literal("google")), externalUrl: v.optional(v.string()), travelDate: v.optional(v.string()), isFeatured: v.optional(v.boolean()) },
  returns: v.id("reviews"),
  handler: async (ctx, args) => {
    const staff = await requireStaff(ctx);
    const id = await ctx.db.insert("reviews", { ...args, authorName: assertString(args.authorName, 120, "authorName", 1), rating: assertInt(args.rating, 1, 5, "rating"), body: assertString(args.body, 4000, "body", 5), status: "approved", isFeatured: args.isFeatured ?? false, moderatedBy: staff._id });
    if (args.tourId) await recomputeTourRating(ctx, args.tourId);
    await audit(ctx, staff, "review.import", "reviews", String(id), undefined, { source: args.source });
    return id;
  },
});

export const remove = mutation({
  args: { id: v.id("reviews") },
  returns: v.null(),
  handler: async (ctx, { id }) => {
    const staff = await requireStaff(ctx);
    const r = await ctx.db.get(id);
    if (!r) return null;
    await ctx.db.delete(id);
    if (r.tourId) await recomputeTourRating(ctx, r.tourId);
    await audit(ctx, staff, "review.delete", "reviews", String(id), { authorName: r.authorName, rating: r.rating });
    return null;
  },
});
