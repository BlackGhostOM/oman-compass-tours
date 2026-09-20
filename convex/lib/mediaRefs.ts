import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { blogSeed } from "../seedData/blog";
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
 * References come in two shapes: CLI imports keep a `storageId`, while the admin
 * upload widget keeps only the resolved `url` (it discards the id). Rather than
 * rewrite every admin screen to carry the id, `liveFiles` resolves the storage
 * table into BOTH ids and URLs, so a reference can be verified whichever shape
 * it has — including bare-string settings and images embedded in Markdown.
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
/** Only URLs served by Convex storage can dangle; seeded /media/placeholders/… paths ship with the site. */
const isStorageUrl = (u: string) => u.includes("/api/storage/");
const urlsOf = (m: AnyMedia): string[] => (m ? [m.url, m.posterUrl].filter((u): u is string => !!u && isStorageUrl(u)) : []);
const hasFile = (m: AnyMedia) => idsOf(m).length > 0 || urlsOf(m).length > 0;

/** Every reference to a stored file that a visitor could see, across all tables. */
export async function collectMediaRefs(ctx: MutationCtx): Promise<MediaRef[]> {
  const refs: MediaRef[] = [];
  const add = (where: string, m: AnyMedia, clear: () => Promise<void>) => {
    if (hasFile(m)) refs.push({ where, ids: idsOf(m), urls: urlsOf(m), clear });
  };
  /**
   * The Open Graph image is a bare URL copy of the cover, shown when a page is shared on
   * WhatsApp or Facebook. It usually rides along with the cover, but importCsv replaces a
   * cover without touching it, so it can be left pointing at a file of its own.
   */
  const addSocialImage = (where: string, ogImageUrl: string | undefined, coverUrl: string | undefined, clear: () => Promise<void>) => {
    if (ogImageUrl && isStorageUrl(ogImageUrl) && ogImageUrl !== coverUrl) {
      refs.push({ where, ids: [], urls: [ogImageUrl], clear });
    }
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
    addSocialImage(`tours/${t.code}/ogImage`, t.seo?.ogImageUrl, t.coverImage?.url, async () =>
      ctx.db.patch(t._id, { seo: t.seo ? { ...t.seo, ogImageUrl: undefined } : undefined, updatedAt: Date.now() }),
    );
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

  // A seeded post gets its own placeholder back: the article hero renders only when a cover
  // exists, so blanking it would drop the image from the article instead of replacing it.
  for (const p of await ctx.db.query("blogPosts").take(500)) {
    const seedKey = blogSeed.find((b) => b.slug.en === p.slug.en)?.image;
    add(`blogPosts/${p.slug.en}/cover`, p.cover, async () => {
      const cover = seedKey ? media(seedKey, p.title) : undefined;
      await ctx.db.patch(p._id, {
        cover,
        seo: p.seo ? { ...p.seo, ogImageUrl: cover?.url } : undefined,
        updatedAt: Date.now(),
      });
    });
    addSocialImage(`blogPosts/${p.slug.en}/ogImage`, p.seo?.ogImageUrl, p.cover?.url, async () =>
      ctx.db.patch(p._id, { seo: p.seo ? { ...p.seo, ogImageUrl: undefined } : undefined, updatedAt: Date.now() }),
    );
  }

  for (const m of await ctx.db.query("teamMembers").take(200)) {
    add(`teamMembers/${m._id}`, m.photo, async () => ctx.db.patch(m._id, { photo: undefined }));
  }

  for (const b of await ctx.db.query("banners").take(200)) {
    add(`banners/${b.key}`, b.media, async () => ctx.db.patch(b._id, { media: undefined }));
  }

  // Settings holding a whole media object (e.g. about.storyImage) or a bare file URL
  // (e.g. home.heroPosterUrl). Deleting the row makes the page fall back to its default,
  // which is also what keeps the About page honest: the stored alt describes the real photo,
  // so blanking the URL while keeping the alt would caption a placeholder with the wrong words.
  //
  // CAUTION: `value` is untyped, so this treats any string or any object with a url as media.
  // That holds because every media-bearing setting is single-purpose today. If a setting ever
  // mixes a file URL with unrelated config under one key, give this an allow-list of keys
  // rather than deleting the whole row.
  for (const s of await ctx.db.query("siteSettings").take(500)) {
    const value = s.value as unknown;
    const asMedia: AnyMedia =
      typeof value === "string" ? { url: value } : value && typeof value === "object" ? (value as AnyMedia) : undefined;
    add(`siteSettings/${s.key}`, asMedia, async () => ctx.db.delete(s._id));
  }

  return refs;
}

/** Hard cap on the storage listing; far above the current file count, and never silently exceeded. */
const FILE_CAP = 20000;

/**
 * Every file that currently exists, by id AND by resolved URL, so a reference
 * can be checked whether or not it kept a storage id.
 *
 * `complete` is false if the listing hit the cap. A URL missing from a TRUNCATED
 * listing proves nothing, so callers must not clear URL-only references then.
 */
export async function liveFiles(ctx: MutationCtx): Promise<{ ids: Set<string>; urls: Set<string>; complete: boolean; count: number }> {
  const files = await ctx.db.system.query("_storage").take(FILE_CAP);
  const ids = new Set<string>();
  const urls = new Set<string>();
  for (const f of files) {
    ids.add(String(f._id));
    const url = await ctx.storage.getUrl(f._id);
    if (url) urls.add(url);
  }
  return { ids, urls, complete: files.length < FILE_CAP, count: files.length };
}

/** A file that has just been deleted. Pass the URL too: admin-written rows keep no id. */
export type DeletedFile = { storageId?: Id<"_storage">; url?: string };

/**
 * Puts back every reference to the given files. Call it right after deleting
 * them, passing the media objects as they were BEFORE deletion so their URLs are
 * still known. Returns what it cleared.
 */
export async function releaseStorageRefs(ctx: MutationCtx, deleted: Iterable<DeletedFile>): Promise<string[]> {
  const goneIds = new Set<string>();
  const goneUrls = new Set<string>();
  for (const d of deleted) {
    if (d.storageId) goneIds.add(String(d.storageId));
    if (d.url && isStorageUrl(d.url)) goneUrls.add(d.url);
  }
  if (goneIds.size === 0 && goneUrls.size === 0) return [];
  const cleared: string[] = [];
  for (const ref of await collectMediaRefs(ctx)) {
    if (ref.ids.some((id) => goneIds.has(String(id))) || ref.urls.some((u) => goneUrls.has(u))) {
      await ref.clear();
      cleared.push(ref.where);
    }
  }
  return cleared;
}
