import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query } from "./_generated/server";
import { media, placeholder } from "./lib/catalogSync";
import { toursSeed } from "./seedData/tours";

/**
 * Bulk photo import for a tour, driven from the CLI (scripts/import-tour-media.mjs):
 *   1. `uploadUrls` hands out N signed upload URLs;
 *   2. the script POSTs each resized JPEG and collects the storage ids;
 *   3. `attachMany` writes the gallery rows (and the cover) in one transaction.
 * Internal only: there is no user identity on `npx convex run`, so staff checks do not apply.
 * `attachMany` takes its payload base64-encoded so Arabic alt text survives the Windows shell.
 */
export const uploadUrls = internalMutation({
  args: { count: v.number() },
  returns: v.array(v.string()),
  handler: async (ctx, { count }) => {
    const urls: string[] = [];
    for (let i = 0; i < Math.min(count, 50); i += 1) urls.push(await ctx.storage.generateUploadUrl());
    return urls;
  },
});

type Payload = {
  code: string;
  items: { storageId: string; alt: { en: string; ar: string }; width: number; height: number }[];
  coverIndex?: number;
  replacePlaceholders?: boolean;
};

function decodePayload(b64: string): Payload {
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const json = JSON.parse(new TextDecoder().decode(bytes)) as Payload;
  if (typeof json.code !== "string" || !Array.isArray(json.items)) throw new Error("Bad payload");
  for (const it of json.items) {
    if (typeof it.storageId !== "string" || typeof it.alt?.en !== "string" || typeof it.alt?.ar !== "string" || typeof it.width !== "number" || typeof it.height !== "number") {
      throw new Error("Bad item in payload");
    }
  }
  return json;
}

export const attachMany = internalMutation({
  args: { payload: v.string() },
  returns: v.object({ tourId: v.id("tours"), added: v.number(), removed: v.number() }),
  handler: async (ctx, { payload }) => {
    const { code, items, coverIndex = 0, replacePlaceholders = true } = decodePayload(payload);
    const tour = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (!tour) throw new Error(`No tour with code ${code}`);

    let removed = 0;
    const existing = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", tour._id)).take(100);
    if (replacePlaceholders) {
      for (const m of existing) {
        if (!m.media.storageId && (m.media.url ?? "").startsWith("/media/placeholders/")) {
          await ctx.db.delete(m._id);
          removed += 1;
        }
      }
    }
    let order = existing.length - removed;

    let cover: Payload["items"][number] | undefined;
    for (const [i, item] of items.entries()) {
      const storageId = item.storageId as Id<"_storage">;
      const url = (await ctx.storage.getUrl(storageId)) ?? undefined;
      const media = { kind: "image" as const, storageId, url, alt: item.alt, width: item.width, height: item.height };
      await ctx.db.insert("tourMedia", { tourId: tour._id, media, order });
      order += 1;
      if (i === coverIndex) cover = item;
    }

    if (cover) {
      const storageId = cover.storageId as Id<"_storage">;
      const url = (await ctx.storage.getUrl(storageId)) ?? undefined;
      await ctx.db.patch(tour._id, {
        coverImage: { kind: "image", storageId, url, alt: cover.alt, width: cover.width, height: cover.height },
        seo: { ...(tour.seo ?? { title: tour.title, description: tour.summary }), ogImageUrl: url },
        updatedAt: Date.now(),
      });
    }
    return { tourId: tour._id, added: items.length, removed };
  },
});

/**
 * Undoes a photo import: deletes every gallery row (and its stored file) for the
 * tour and puts the seeded placeholder gallery and cover back.
 */
export const restorePlaceholders = internalMutation({
  args: { code: v.string() },
  returns: v.object({ tourId: v.id("tours"), removed: v.number(), restored: v.number() }),
  handler: async (ctx, { code }) => {
    const tour = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique();
    if (!tour) throw new Error(`No tour with code ${code}`);
    const seed = toursSeed.find((t) => t.code === code);
    if (!seed) throw new Error(`No seed entry for ${code}`);

    const rows = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", tour._id)).take(200);
    for (const m of rows) {
      if (m.media.storageId) await ctx.storage.delete(m.media.storageId).catch(() => {});
      await ctx.db.delete(m._id);
    }
    const extras = [seed.image, "muscat", "wahiba", "jebel-akhdar", "wadi-shab"].filter((k, i, a) => a.indexOf(k) === i).slice(0, 4);
    for (const [i, key] of extras.entries()) {
      await ctx.db.insert("tourMedia", { tourId: tour._id, media: media(key, tour.title), order: i });
    }
    if (tour.coverImage?.storageId) await ctx.storage.delete(tour.coverImage.storageId).catch(() => {});
    await ctx.db.patch(tour._id, {
      coverImage: media(seed.image, tour.title),
      seo: { ...(tour.seo ?? { title: tour.title, description: tour.summary }), ogImageUrl: placeholder(seed.image) },
      updatedAt: Date.now(),
    });
    return { tourId: tour._id, removed: rows.length, restored: extras.length };
  },
});

/** Deletes uploaded files that never got attached (called by the import script when attaching fails). */
export const discard = internalMutation({
  args: { storageIds: v.array(v.id("_storage")) },
  returns: v.number(),
  handler: async (ctx, { storageIds }) => {
    let n = 0;
    for (const id of storageIds) {
      await ctx.storage.delete(id).catch(() => {});
      n += 1;
    }
    return n;
  },
});

/**
 * Removes image files uploaded after `since` (ms epoch) that no tour gallery or
 * cover references — the leftovers of an import that failed half-way.
 */
export const sweepOrphanedTourImages = internalMutation({
  args: { since: v.number() },
  returns: v.object({ scanned: v.number(), deleted: v.number() }),
  handler: async (ctx, { since }) => {
    const referenced = new Set<string>();
    for (const m of await ctx.db.query("tourMedia").take(5000)) if (m.media.storageId) referenced.add(m.media.storageId);
    for (const t of await ctx.db.query("tours").take(500)) {
      if (t.coverImage?.storageId) referenced.add(t.coverImage.storageId);
      if (t.video?.storageId) referenced.add(t.video.storageId);
      if (t.video?.posterStorageId) referenced.add(t.video.posterStorageId);
    }
    const files = await ctx.db.system.query("_storage").order("desc").take(1000);
    let scanned = 0;
    let deleted = 0;
    for (const f of files) {
      if (f._creationTime < since) break;
      scanned += 1;
      if (f.contentType !== "image/jpeg" || referenced.has(f._id)) continue;
      await ctx.storage.delete(f._id);
      deleted += 1;
    }
    return { scanned, deleted };
  },
});

/**
 * Every image URL shown for published tours (cover + gallery), for warming the
 * image-optimizer cache. Public and unauthenticated on purpose: the weekly
 * GitHub Actions warm-up calls it without a deploy key, and the URLs are the
 * same ones already rendered in the public tour pages.
 */
export const imageUrls = query({
  args: { code: v.optional(v.string()) },
  returns: v.array(v.string()),
  handler: async (ctx, { code }) => {
    const tours = code
      ? [await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", code)).unique()].filter((t) => !!t)
      : await ctx.db.query("tours").withIndex("by_status", (q) => q.eq("status", "published")).take(500);
    const urls = new Set<string>();
    for (const t of tours) {
      if (!t || t.status !== "published") continue;
      const cover = t.coverImage?.url ?? (t.coverImage?.storageId ? await ctx.storage.getUrl(t.coverImage.storageId) : null);
      if (cover?.startsWith("http")) urls.add(cover);
      const rows = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", t._id)).take(100);
      for (const m of rows) {
        if (m.media.kind !== "image") continue;
        const u = m.media.url ?? (m.media.storageId ? await ctx.storage.getUrl(m.media.storageId) : null);
        if (u?.startsWith("http")) urls.add(u);
      }
    }
    return [...urls];
  },
});
