import { v } from "convex/values";
import type { Id } from "./_generated/dataModel";
import { internalMutation } from "./_generated/server";

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
