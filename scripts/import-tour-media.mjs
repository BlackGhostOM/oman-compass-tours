/**
 * Uploads a folder of photos to Convex storage and attaches them to a tour.
 *
 *   node scripts/import-tour-media.mjs <manifest.json> [--prod]
 *
 * manifest.json:
 * {
 *   "code": "OCT-001",
 *   "folder": "C:/photos/muscat-city-tour",
 *   "coverIndex": 0,
 *   "items": [{ "file": "IMG_7696.jpg", "alt": { "en": "…", "ar": "…" } }, …]
 * }
 *
 * Photos are auto-rotated (EXIF), resized to max 2400 px and re-encoded as JPEG
 * before upload. Requires `sharp` (a Next.js dependency) and the Convex CLI.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";

const [manifestPath, ...flags] = process.argv.slice(2);
if (!manifestPath) {
  console.error("usage: node scripts/import-tour-media.mjs <manifest.json> [--prod]");
  process.exit(1);
}
const prod = flags.includes("--prod");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
const MAX_EDGE = 2400;

function convexRun(fn, args) {
  // With shell: true the JSON must be quoted for cmd.exe, which would otherwise strip the double quotes.
  const quoted = '"' + JSON.stringify(args).replace(/"/g, '\\"') + '"';
  const res = spawnSync("npx", ["convex", "run", fn, quoted, ...(prod ? ["--prod"] : [])], {
    encoding: "utf8",
    shell: true,
    windowsHide: true,
  });
  if (res.status !== 0) {
    console.error(res.stderr || res.stdout);
    throw new Error(`convex run ${fn} failed`);
  }
  const out = res.stdout;
  const start = Math.min(...["{", "["].map((c) => (out.indexOf(c) < 0 ? Infinity : out.indexOf(c))));
  return JSON.parse(out.slice(start));
}

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "oct-media-"));
const prepared = [];
for (const item of manifest.items) {
  const src = path.join(manifest.folder, item.file);
  const out = path.join(tmp, path.parse(item.file).name + ".jpg");
  const info = await sharp(src).rotate().resize({ width: MAX_EDGE, height: MAX_EDGE, fit: "inside", withoutEnlargement: true }).jpeg({ quality: 82, mozjpeg: true }).toFile(out);
  prepared.push({ ...item, path: out, width: info.width, height: info.height, bytes: info.size });
  console.log(`prepared ${item.file} → ${info.width}x${info.height} (${Math.round(info.size / 1024)} KB)`);
}

const urls = convexRun("mediaImport:uploadUrls", { count: prepared.length });
if (urls.length !== prepared.length) throw new Error("did not receive enough upload URLs");

const items = [];
for (const [i, p] of prepared.entries()) {
  const res = await fetch(urls[i], { method: "POST", headers: { "Content-Type": "image/jpeg" }, body: fs.readFileSync(p.path) });
  if (!res.ok) throw new Error(`upload failed for ${p.file}: ${res.status} ${await res.text()}`);
  const { storageId } = await res.json();
  items.push({ storageId, alt: p.alt, width: p.width, height: p.height });
  console.log(`uploaded ${p.file} → ${storageId}`);
}

const payload = Buffer.from(JSON.stringify({ code: manifest.code, items, coverIndex: manifest.coverIndex ?? 0, replacePlaceholders: manifest.replacePlaceholders ?? true }), "utf8").toString("base64");
const result = convexRun("mediaImport:attachMany", { payload });
console.log(`${prod ? "PROD" : "DEV"} ${manifest.code}: added ${result.added}, removed ${result.removed} placeholders (tour ${result.tourId})`);
fs.rmSync(tmp, { recursive: true, force: true });
