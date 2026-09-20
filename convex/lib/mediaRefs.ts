import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { destinationsSeed } from "../seedData/destinations";
import { toursSeed } from "../seedData/tours";
import { media } from "./catalogSync";

/**
 * Keeps photo references from outliving the files they point at.
 *
 * Every photo is stored as a frozen `{ storageId?, url }` pair and every page
 * renders `row.field?.url ?? "/media/placeholders/….jpg"`. That fallback only
 * fires when the field is EMPTY, so a row still pointing at a DELETED file
 * renders a broken image box instead of the placeholder — and rows borrow each
 * other's files (a destination card, a blog cover or a site setting can all
 * point at one tour gallery photo).
 *
 * The cure is deliberately boring: put the row back to a placeholder. Tours and
 * destinations get the specific placeholder their seed names; everything else
 * clears the field, which its own render path already handles. Nothing on the
 * render path changes, and a healthy row is never touched.
 *
 * Two kinds of reference exist and they must be treated differently:
 *  - CLI imports store a `storageId`, so the file can be checked and matched.
 *  - The admin upload widget keeps only the resolved `url` (it discards the id),
 *    so those rows can only be matched by URL. They are still listed here,
 *    because `sweepOrphanedTourImages` must not delete a file just because no
 *    storageId points at it.
 */

/** One place a stored file is referenced, and how to let go of it. */
export type MediaRef = {
  /** Human-readable location, for the healer's log: "destinations/jebel_akhdar". */
  where: string;
  /** Storage ids this reference depends on; if any is gone the reference is dangling. */
  ids: Id<"_storage">[];
  /** Resolved file URLs it depends on. Present for admin uploads, which keep no id. */
  urls: string[];
  /** Puts the reference back to a placeholder so the page stops showing a broken image. */
  clear: () => Promise<void>;
};

type AnyMedia = { storageId?: Id<"_storage">; posterStorageId?: Id<"_storage">; url?: string; posterUrl?: string } | undefined;

const idsOf = (m: AnyMedia): Id<"_storage">[] => (m ? ([m.storageId, m.posterStorageId].filter(Boolean) as Id<"_storage">[]) : []);
/** Only URLs served by Convex storage can dangle; seeded /media/placeholders/… paths are static files. */
const urlsOf = (m: AnyMedia): string[] =>
  m ? [m.url, m.posterUrl].filter((u): u is string => !!u && /\/api\/storage\//.test(u)) : [];
const hasFile = (m: AnyMedia) => idsOf(m).length > 0 || urlsOf(m).length > 0;

/** Every reference to a stored file that a visitor could see, across all tables. */
export async function collectMediaRefs(ctx: MutationCtx): Promise<MediaRef[]> {
  const refs: MediaRef[] = [];
  const add = (where: string, m: AnyMedia, clear: () => Promise<void>) => {
    if (hasFile(m)) refs.push({ where, ids: idsOf(m), urls: urlsOf(m), clear });
  };

  // Tours know which placeholder each row deserves, so put that one back rather than blanking the field.
  // The SEO image is a bare copy of the cover URL, so it goes with the cover.
  for (const t of await ctx.db.query("tours").take(1000)) {
    const seedKey = toursSeed.find((s) => s.code === t.code)?.image;
    add(`tours/${t.code}/coverImage`, t.coverImage, async () => {
      const cover = seedKey ? media(seedKey, t.title) : undefined;
      await ctx.db.patch(t._id, {
        coverImage: cover,
        seo: t.seo ? { ...t.seo, ogImageUrl: cover?.url } : undefined,
        updatedAt: Date.now(),
      });
    });
    add(`tours/${t.code}/video`, t.video, async () => ctx.db.patch(t._id, { video: undefined, updatedAt: Date.now() }));
  }

  // Gallery rows own the files. A row whose file is gone has nothing left to show, so it is deleted
  // rather than blanked — the same thing staff removing a photo already does.
  for (const m of await ctx.db.query("tourMedia").take(5000)) {
    add(`tourMedia/${m._id}`, m.media, async () => ctx.db.delete(m._id));
  }

  for (const d of await ctx.db.query("destinations").take(200)) {
    const seedKey = destinationsSeed.find((s) => s.key === d.key)?.image;
    add(`destinations/${d.key}`, d.image, async () => ctx.db.patch(d._id, { image: seedKey ? media(seedKey, d.name) : undefined }));
  }

  for (const p of await ctx.db.query("blogPosts").take(500)) {
    add(`blogPosts/${p.slug.en}`, p.cover, async () => {
      await ctx.db.patch(p._id, {
        cover: undefined,
        seo: p.seo ? { ...p.seo, ogImageUrl: undefined } : undefined,
        updatedAt: Date.now(),
      });
    });
  }

  for (const m of await ctx.db.query("teamMembers").take(200)) {
    add(`teamMembers/${m._id}`, m.photo, async () => ctx.db.patch(m._id, { photo: undefined }));
  }

  for (const b of await ctx.db.query("banners").take(200)) {
    add(`banners/${b.key}`, b.media, async () => ctx.db.patch(b._id, { media: undefined }));
  }

  // Settings holding a whole media object (e.g. about.storyImage) or a bare file URL
  // (e.g. home.heroPosterUrl). Deleting the row makes the page fall back to its default.
  for (const s of await ctx.db.query("siteSettings").take(500)) {
    const value = s.value as unknown;
    const asMedia: AnyMedia =
      typeof value === "string" ? { url: value } : value && typeof value === "object" ? (value as AnyMedia) : undefined;
    add(`siteSettings/${s.key}`, asMedia, async () => ctx.db.delete(s._id));
  }

  return refs;
}

/**
 * Puts back every reference to the given storage ids. Call it right after
 * deleting files, so no row is left pointing at one. Returns what it cleared.
 */
export async function releaseStorageRefs(ctx: MutationCtx, deleted: Iterable<Id<"_storage">>): Promise<string[]> {
  const gone = new Set<string>([...deleted].map(String));
  if (gone.size === 0) return [];
  const cleared: string[] = [];
  for (const ref of await collectMediaRefs(ctx)) {
    if (ref.ids.some((id) => gone.has(String(id)))) {
      await ref.clear();
      cleared.push(ref.where);
    }
  }
  return cleared;
}
