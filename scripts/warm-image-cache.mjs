/**
 * Warms the Next.js image-optimizer cache for tour photos, so visitors never
 * wait for a cold transcode (2–3 s per image/size/format on Vercel).
 *
 *   node scripts/warm-image-cache.mjs [--prod] [--code OCT-010] [--site https://…]
 *
 * Fetches every width the site's `sizes` attributes can select, in AVIF and
 * WebP, for the cover and gallery of every published tour (or one tour).
 */
import { spawnSync } from "node:child_process";

const args = process.argv.slice(2);
const prod = args.includes("--prod");
const arg = (name) => (args.includes(name) ? args[args.indexOf(name) + 1] : undefined);
const code = arg("--code");
const site = arg("--site") ?? (prod ? "https://www.omancompasstours.com" : "http://localhost:3000");

// deviceSizes/imageSizes actually selected by the site's `sizes` (cards, hero, lightbox, filmstrip, at 1x–3x DPR)
const WIDTHS = [96, 256, 384, 640, 1080, 1200, 1920, 2048];
const ACCEPTS = ["image/avif,image/webp,image/*,*/*;q=0.8", "image/webp,image/*,*/*;q=0.8"];
const CONCURRENCY = 12;

const quoted = '"' + JSON.stringify({ code }).replace(/"/g, '\\"') + '"';
const res = spawnSync("npx", ["convex", "run", "mediaImport:imageUrls", quoted, ...(prod ? ["--prod"] : [])], { encoding: "utf8", shell: true, windowsHide: true });
if (res.status !== 0) {
  console.error(res.stderr || res.stdout);
  process.exit(1);
}
const out = res.stdout;
const urls = JSON.parse(out.slice(out.indexOf("[")));
console.log(`${urls.length} images × ${WIDTHS.length} widths × ${ACCEPTS.length} formats = ${urls.length * WIDTHS.length * ACCEPTS.length} requests → ${site}`);

const jobs = [];
for (const u of urls) for (const w of WIDTHS) for (const accept of ACCEPTS) jobs.push({ u, w, accept });

let done = 0;
let failed = 0;
let bytes = 0;
const t0 = Date.now();
async function worker() {
  while (jobs.length) {
    const { u, w, accept } = jobs.shift();
    const target = `${site}/_next/image?url=${encodeURIComponent(u)}&w=${w}&q=75`;
    try {
      const r = await fetch(target, { headers: { Accept: accept } });
      if (!r.ok) failed += 1;
      else bytes += (await r.arrayBuffer()).byteLength;
    } catch {
      failed += 1;
    }
    done += 1;
    if (done % 100 === 0) console.log(`  ${done} done, ${failed} failed, ${Math.round((Date.now() - t0) / 1000)} s`);
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, worker));
console.log(`warmed ${done - failed}/${done} variants (${Math.round(bytes / 1024 / 1024)} MB) in ${Math.round((Date.now() - t0) / 1000)} s${failed ? `, ${failed} failed` : ""}`);
