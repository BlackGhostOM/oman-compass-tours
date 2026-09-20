import sharp from "sharp";

/**
 * Cover-cropped JPEG copies of tour photos for HTML emails, where images cannot
 * be cropped with CSS: /api/email-image?src=<photo url>&w=312&h=208
 *
 * Sources are limited to the site's own /media files and Convex storage, so
 * this is not an open image proxy. Responses are immutable and CDN-cached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_EDGE = 1600;
const MAX_BYTES = 25 * 1024 * 1024;
const ALLOWED_HOST = /(^|\.)convex\.(cloud|site)$/;

const size = (raw: string | null) => {
  const n = Number.parseInt(raw ?? "", 10);
  return Number.isFinite(n) && n >= 16 && n <= MAX_EDGE ? n : null;
};

export async function GET(req: Request) {
  const url = new URL(req.url);
  const w = size(url.searchParams.get("w"));
  const h = size(url.searchParams.get("h")); // optional: without it the photo is resized to the width, keeping its aspect
  const src = url.searchParams.get("src") ?? "";
  if (!w) return new Response("Bad size", { status: 400 });

  let source: URL;
  if (src.startsWith("/") && !src.startsWith("//")) {
    source = new URL(src, url.origin);
  } else {
    try {
      source = new URL(src);
    } catch {
      return new Response("Bad source", { status: 400 });
    }
    if (source.protocol !== "https:" || !ALLOWED_HOST.test(source.hostname)) return new Response("Source not allowed", { status: 403 });
  }

  const upstream = await fetch(source, { cache: "no-store" }).catch(() => null);
  if (!upstream?.ok) return new Response("Source unavailable", { status: 502 });
  if (Number(upstream.headers.get("content-length") ?? 0) > MAX_BYTES) return new Response("Source too large", { status: 413 });
  const input = Buffer.from(await upstream.arrayBuffer());
  if (input.byteLength > MAX_BYTES) return new Response("Source too large", { status: 413 });

  try {
    const out = await sharp(input)
      .rotate() // honour EXIF orientation
      .resize(h ? { width: w, height: h, fit: "cover", position: sharp.strategy.attention } : { width: w, withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
    return new Response(new Uint8Array(out), {
      headers: {
        "Content-Type": "image/jpeg",
        "Content-Length": String(out.byteLength),
        "Cache-Control": "public, max-age=31536000, s-maxage=31536000, immutable",
      },
    });
  } catch {
    return new Response("Not an image", { status: 415 });
  }
}
