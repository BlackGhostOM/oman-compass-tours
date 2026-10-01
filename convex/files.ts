import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { enforceRateLimit, requireStaff, requireUser } from "./lib/access";

/** Signed upload URL for the signed-in customer (documents) or staff (media). */
export const generateUploadUrl = mutation({
  args: { purpose: v.union(v.literal("document"), v.literal("media")) },
  returns: v.string(),
  handler: async (ctx, { purpose }) => {
    if (purpose === "media") await requireStaff(ctx);
    else {
      const user = await requireUser(ctx);
      // A customer never needs more than a handful of documents; stop storage abuse.
      await enforceRateLimit(ctx, `upload:${user._id}`, 20, 60 * 60 * 1000);
    }
    return await ctx.storage.generateUploadUrl();
  },
});

export const getUrl = query({
  args: { storageId: v.id("_storage") },
  returns: v.union(v.string(), v.null()),
  handler: async (ctx, { storageId }) => {
    await requireStaff(ctx);
    return await ctx.storage.getUrl(storageId);
  },
});
