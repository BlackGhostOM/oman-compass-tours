import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getViewer, requireUser, assertString } from "./lib/access";
import { localeValidator } from "./schema";

/** Public-safe projection of the signed-in user. */
export const viewer = query({
  args: {},
  returns: v.union(
    v.null(),
    v.object({
      _id: v.id("users"),
      name: v.union(v.string(), v.null()),
      email: v.union(v.string(), v.null()),
      image: v.union(v.string(), v.null()),
      phone: v.union(v.string(), v.null()),
      role: v.string(),
      locale: v.string(),
      nationality: v.union(v.string(), v.null()),
      loyaltyPoints: v.number(),
      referralCode: v.union(v.string(), v.null()),
      marketingOptIn: v.boolean(),
    }),
  ),
  handler: async (ctx) => {
    const user = await getViewer(ctx);
    if (!user) return null;
    return {
      _id: user._id,
      name: user.name ?? null,
      email: user.email ?? null,
      image: user.image ?? null,
      phone: user.phone ?? null,
      role: user.role ?? "customer",
      locale: user.locale ?? "en",
      nationality: user.nationality ?? null,
      loyaltyPoints: user.loyaltyPoints ?? 0,
      referralCode: user.referralCode ?? null,
      marketingOptIn: user.marketingOptIn ?? false,
    };
  },
});

export const updateProfile = mutation({
  args: {
    name: v.optional(v.string()),
    phone: v.optional(v.string()),
    nationality: v.optional(v.string()),
    locale: v.optional(localeValidator),
    marketingOptIn: v.optional(v.boolean()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const user = await requireUser(ctx);
    const patch: Partial<typeof user> = {};
    if (args.name !== undefined) patch.name = assertString(args.name, 120, "name", 1);
    if (args.phone !== undefined) patch.phone = assertString(args.phone, 32, "phone");
    if (args.nationality !== undefined) patch.nationality = assertString(args.nationality, 2, "nationality");
    if (args.locale !== undefined) patch.locale = args.locale;
    if (args.marketingOptIn !== undefined) patch.marketingOptIn = args.marketingOptIn;
    await ctx.db.patch(user._id, patch);
    return { ok: true };
  },
});
