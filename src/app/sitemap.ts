import type { MetadataRoute } from "next";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../convex/_generated/api";
import { site } from "@/lib/site";

const staticPaths = ["", "/tours", "/services", "/destinations", "/about", "/contact", "/booking-methods", "/blog", "/plan-my-trip", "/policies/terms", "/policies/cancellation", "/policies/refund", "/policies/privacy", "/policies/cookies", "/policies/waiver", "/policies/child", "/policies/payment"];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = site.url;
  const entries: MetadataRoute.Sitemap = [];

  for (const path of staticPaths) {
    entries.push({
      url: `${base}/en${path}`,
      lastModified: new Date(),
      changeFrequency: path === "" ? "daily" : "weekly",
      priority: path === "" ? 1 : 0.7,
      alternates: { languages: { en: `${base}/en${path}`, ar: `${base}/ar${path}` } },
    });
  }

  try {
    const [tours, destinations, posts] = await Promise.all([
      fetchQuery(api.tours.slugs, {}),
      fetchQuery(api.catalog.destinations, {}),
      fetchQuery(api.blog.list, { limit: 100 }),
    ]);
    for (const t of tours) {
      entries.push({
        url: `${base}/en/tours/${t.slug.en}`,
        lastModified: new Date(t.updatedAt),
        changeFrequency: "weekly",
        priority: 0.9,
        alternates: { languages: { en: `${base}/en/tours/${t.slug.en}`, ar: `${base}/ar/tours/${encodeURIComponent(t.slug.ar)}` } },
      });
    }
    for (const d of destinations) {
      entries.push({
        url: `${base}/en/destinations/${d.slug.en}`,
        changeFrequency: "monthly",
        priority: 0.6,
        alternates: { languages: { en: `${base}/en/destinations/${d.slug.en}`, ar: `${base}/ar/destinations/${encodeURIComponent(d.slug.ar)}` } },
      });
    }
    for (const p of posts) {
      entries.push({
        url: `${base}/en/blog/${p.slug.en}`,
        lastModified: new Date(p.publishedAt),
        changeFrequency: "monthly",
        priority: 0.5,
        alternates: { languages: { en: `${base}/en/blog/${p.slug.en}`, ar: `${base}/ar/blog/${encodeURIComponent(p.slug.ar)}` } },
      });
    }
  } catch (err) {
    console.error("[sitemap] dynamic entries skipped:", (err as Error).message);
  }

  return entries;
}
