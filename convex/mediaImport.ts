import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation, query, type MutationCtx } from "./_generated/server";
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
    // Destination cards/heroes (only when warming everything, not a single tour)
    if (!code) {
      for (const d of await ctx.db.query("destinations").take(50)) {
        if (!d.isActive || !d.image) continue;
        const u = d.image.url ?? (d.image.storageId ? await ctx.storage.getUrl(d.image.storageId) : null);
        if (u?.startsWith("http")) urls.add(u);
      }
    }
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

/**
 * Finds one photo in a tour's gallery by a case-insensitive substring of its
 * English alt text and resolves its URL. Shared by the mutations below, which
 * all point something at an EXISTING gallery photo, reusing the stored file
 * rather than re-uploading it.
 */
async function findGalleryImage(ctx: MutationCtx, tourCode: string, alt: string) {
  const tour = await ctx.db.query("tours").withIndex("by_code", (q) => q.eq("code", tourCode)).unique();
  if (!tour) throw new Error(`No tour with code ${tourCode}`);
  const rows = await ctx.db.query("tourMedia").withIndex("by_tour_order", (q) => q.eq("tourId", tour._id)).take(200);
  const needle = alt.toLowerCase();
  const hit = rows.find((m) => m.media.kind === "image" && m.media.alt.en.toLowerCase().includes(needle));
  if (!hit) throw new Error(`No gallery image in ${tourCode} whose alt contains "${alt}"`);
  const url = hit.media.url ?? (hit.media.storageId ? (await ctx.storage.getUrl(hit.media.storageId)) ?? undefined : undefined);
  if (!url) throw new Error(`Matched image "${hit.media.alt.en}" has no URL`);
  return { tour, rows, hit, media: { ...hit.media, url }, url };
}

/**
 * Makes an existing gallery photo the tour's cover, matched by its English alt
 * text (case-insensitive substring), and moves it to the front of the gallery.
 */
export const setCoverByAlt = internalMutation({
  args: { code: v.string(), alt: v.string() },
  returns: v.object({ tourId: v.id("tours"), matched: v.string() }),
  handler: async (ctx, { code, alt }) => {
    const { tour, rows, hit, media, url } = await findGalleryImage(ctx, code, alt);
    await ctx.db.patch(tour._id, {
      coverImage: media,
      seo: { ...(tour.seo ?? { title: tour.title, description: tour.summary }), ogImageUrl: url },
      updatedAt: Date.now(),
    });
    // Cover first, then the rest in their current order
    const ordered = [hit, ...rows.filter((m) => m._id !== hit._id).sort((a, b) => a.order - b.order)];
    for (const [i, m] of ordered.entries()) if (m.order !== i) await ctx.db.patch(m._id, { order: i });
    return { tourId: tour._id, matched: hit.media.alt.en };
  },
});

/**
 * Points a site setting at an existing tour gallery photo, so a page can show a
 * real photo instead of a seeded placeholder. Stores the whole media object
 * (storageId included, so the photo can be re-resolved if its URL ever changes).
 * Storage URLs are per-deployment, so run this on dev and on prod.
 */
export const setSettingImageByAlt = internalMutation({
  args: { key: v.string(), tourCode: v.string(), alt: v.string() },
  returns: v.object({ key: v.string(), matched: v.string(), url: v.string() }),
  handler: async (ctx, { key, tourCode, alt }) => {
    const { hit, media, url } = await findGalleryImage(ctx, tourCode, alt);
    const existing = await ctx.db.query("siteSettings").withIndex("by_key", (q) => q.eq("key", key)).unique();
    if (existing) await ctx.db.patch(existing._id, { value: media, updatedAt: Date.now() });
    else await ctx.db.insert("siteSettings", { key, value: media, updatedAt: Date.now() });
    return { key, matched: hit.media.alt.en, url };
  },
});

/**
 * Gives a blog post its cover photo from an existing tour gallery, matched by
 * the post's English slug. The photo keeps its own bilingual alt text, which the
 * blog card prefers over the post title.
 */
export const setBlogCoverByAlt = internalMutation({
  args: { slug: v.string(), tourCode: v.string(), alt: v.string() },
  returns: v.object({ slug: v.string(), matched: v.string(), url: v.string() }),
  handler: async (ctx, { slug, tourCode, alt }) => {
    const post = await ctx.db.query("blogPosts").withIndex("by_slug_en", (q) => q.eq("slug.en", slug)).unique();
    if (!post) throw new Error(`No blog post with English slug ${slug}`);
    const { hit, media, url } = await findGalleryImage(ctx, tourCode, alt);
    await ctx.db.patch(post._id, {
      cover: media,
      seo: { ...(post.seo ?? { title: post.title, description: post.excerpt }), ogImageUrl: url },
      updatedAt: Date.now(),
    });
    return { slug, matched: hit.media.alt.en, url };
  },
});

/**
 * Points a destination's card/hero image at an existing tour gallery photo
 * (matched by tour code + English alt substring). The destination keeps its own
 * bilingual alt text.
 */
export const setDestinationImage = internalMutation({
  args: { destinationKey: v.string(), tourCode: v.string(), alt: v.string() },
  returns: v.object({ destination: v.string(), matched: v.string() }),
  handler: async (ctx, { destinationKey, tourCode, alt }) => {
    const dest = await ctx.db.query("destinations").withIndex("by_key", (q) => q.eq("key", destinationKey)).unique();
    if (!dest) throw new Error(`No destination with key ${destinationKey}`);
    const { hit, media } = await findGalleryImage(ctx, tourCode, alt);
    await ctx.db.patch(dest._id, { image: { ...media, alt: dest.name } });
    return { destination: destinationKey, matched: hit.media.alt.en };
  },
});
