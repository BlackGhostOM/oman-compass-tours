import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { enforceRateLimit } from "./lib/access";
import { generateToken } from "./lib/ids";
import { localeValidator } from "./schema";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export const subscribe = mutation({
  args: {
    email: v.string(),
    locale: localeValidator,
    source: v.optional(v.string()),
  },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, args) => {
    const email = args.email.trim().toLowerCase();
    if (!EMAIL_RE.test(email) || email.length > 254) {
      throw new ConvexError({ code: "INVALID_ARGUMENT", field: "email" });
    }
    await enforceRateLimit(ctx, `newsletter:${email}`, 3, 60 * 60 * 1000);

    const existing = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_email", (q) => q.eq("email", email))
      .unique();

    if (existing) {
      if (existing.unsubscribedAt) {
        await ctx.db.patch(existing._id, { unsubscribedAt: undefined, locale: args.locale });
        await ctx.scheduler.runAfter(0, internal.newsletterSend.sendWelcome, { subscriberId: existing._id });
      }
      return { ok: true };
    }

    const id = await ctx.db.insert("newsletterSubscribers", {
      email,
      locale: args.locale,
      source: args.source?.slice(0, 64),
      token: generateToken(),
    });
    // The first newsletter goes out immediately: a welcome note with our signature tours.
    await ctx.scheduler.runAfter(0, internal.newsletterSend.sendWelcome, { subscriberId: id });
    return { ok: true };
  },
});

export const unsubscribe = mutation({
  args: { token: v.string() },
  returns: v.object({ ok: v.boolean() }),
  handler: async (ctx, { token }) => {
    const sub = await ctx.db
      .query("newsletterSubscribers")
      .withIndex("by_token", (q) => q.eq("token", token))
      .unique();
    if (sub && !sub.unsubscribedAt) {
      await ctx.db.patch(sub._id, { unsubscribedAt: Date.now() });
    }
    return { ok: true };
  },
});
