import { v } from "convex/values";
import { query } from "./_generated/server";

/** Home-page content: hero banner, promo banners, team, settings. */
export const home = query({
  args: {},
  handler: async (ctx) => {
    const now = Date.now();
    const banners = (await ctx.db.query("banners").withIndex("by_placement", (q) => q.eq("placement", "home_hero")).take(5)).filter(
      (b) => b.isActive && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt >= now),
    );
    const promos = (await ctx.db.query("banners").withIndex("by_placement", (q) => q.eq("placement", "home_promo")).take(5)).filter(
      (b) => b.isActive && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt >= now),
    );
    const reelRows = (await ctx.db.query("banners").withIndex("by_placement", (q) => q.eq("placement", "home_reel")).take(12)).filter((b) => b.isActive);
    const reels = await Promise.all(
      reelRows.map(async (b) => ({
        url: b.media?.storageId ? await ctx.storage.getUrl(b.media.storageId) : (b.media?.url ?? null),
        posterUrl: b.media?.posterStorageId ? await ctx.storage.getUrl(b.media.posterStorageId) : (b.media?.posterUrl ?? null),
        alt: b.media?.alt ?? { en: "Oman Compass Tours reel", ar: "مقطع من جولات بوصلة عُمان" },
        caption: b.title ?? null,
      })),
    );
    const heroVideo = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "home.heroVideoUrl")).unique();
    const heroPoster = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "home.heroPosterUrl")).unique();
    return {
      hero: banners[0] ?? null,
      promos,
      reels: reels.filter((r) => r.url),
      heroVideoUrl: typeof heroVideo?.value === "string" && heroVideo.value ? heroVideo.value : null,
      heroPosterUrl: typeof heroPoster?.value === "string" && heroPoster.value ? heroPoster.value : "/media/placeholders/hero.jpg",
    };
  },
});

export const team = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("teamMembers").withIndex("by_order").take(50);
    return rows.filter((m) => m.isActive);
  },
});

export const setting = query({
  args: { key: v.string() },
  handler: async (ctx, { key }) => {
    const row = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", key)).unique();
    return row?.value ?? null;
  },
});

/** Public support status (online hours + expected response time). */
export const supportStatus = query({
  args: {},
  handler: async (ctx) => {
    const hours = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "chat.onlineHours")).unique();
    const eta = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", "chat.expectedResponseMinutes")).unique();
    const cfg = (hours?.value as { start: string; end: string; timezone: string } | undefined) ?? { start: "07:30", end: "19:30", timezone: "Asia/Muscat" };
    const nowMuscat = new Intl.DateTimeFormat("en-GB", { timeZone: cfg.timezone, hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date());
    const online = nowMuscat >= cfg.start && nowMuscat <= cfg.end;
    return { online, hours: cfg, expectedResponseMinutes: typeof eta?.value === "number" ? eta.value : 10 };
  },
});
