import { v } from "convex/values";
import type { QueryCtx } from "../_generated/server";
import { localized } from "../schema";
import type { EmailTour } from "./newsletterEmail";

/** The slice of a tour that the newsletter renderers need (see EmailTour). */
export const emailTourValidator = v.object({
  code: v.string(),
  title: localized,
  slug: localized,
  summary: localized,
  highlights: v.array(localized),
  durationLabel: localized,
  durationDays: v.number(),
  maxGroup: v.number(),
  freeCancellationHours: v.number(),
  priceFrom: v.number(),
  pricingModel: v.string(),
  ratingAverage: v.number(),
  ratingCount: v.number(),
  externalReviewCount: v.optional(v.number()),
  coverUrl: v.optional(v.string()),
});

/** A published tour by code, with its cover resolved to a URL; null when missing or unpublished. */
export async function loadEmailTour(ctx: QueryCtx, code: string): Promise<EmailTour | null> {
  const t = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
  if (!t || t.status !== "published") return null;
  const cover = t.coverImage;
  const coverUrl = cover?.url ?? (cover?.storageId ? await ctx.storage.getUrl(cover.storageId) : null);
  return {
    code: t.code,
    title: t.title,
    slug: t.slug,
    summary: t.summary,
    highlights: t.highlights,
    durationLabel: t.durationLabel,
    durationDays: t.durationDays,
    maxGroup: t.maxGroup,
    freeCancellationHours: t.freeCancellationHours,
    priceFrom: t.priceFrom,
    pricingModel: t.pricingModel,
    ratingAverage: t.ratingAverage,
    ratingCount: t.ratingCount,
    externalReviewCount: t.externalReviewCount,
    coverUrl: coverUrl ?? undefined,
  };
}

/** Published tours for the given codes, in the given order, skipping unknown ones and duplicates. */
export async function loadEmailTours(ctx: QueryCtx, codes: string[]): Promise<EmailTour[]> {
  const out: EmailTour[] = [];
  for (const code of codes) {
    if (out.some((t) => t.code === code)) continue;
    const t = await loadEmailTour(ctx, code);
    if (t) out.push(t);
  }
  return out;
}
