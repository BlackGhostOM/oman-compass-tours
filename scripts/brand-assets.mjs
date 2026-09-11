import sharp from "sharp";
import { mkdirSync } from "node:fs";
const src = "public/brand/logo-source.jpg";
mkdirSync("public/brand", { recursive: true });
mkdirSync("public/icons", { recursive: true });
const meta = await sharp(src).metadata();
console.log("source", meta.width, meta.height);
// Full logo (PNG, lossless)
await sharp(src).png({ compressionLevel: 9 }).toFile("public/brand/logo.png");
// Compass mark only (square crop around the rose)
const W = meta.width, H = meta.height;
const cx = Math.round(W * 0.497), cy = Math.round(H * 0.352), r = Math.round(W * 0.205);
const mark = sharp(src).extract({ left: cx - r, top: cy - r, width: 2 * r, height: 2 * r });
await mark.clone().png().toFile("public/brand/logo-mark.png");
for (const s of [192, 512]) await mark.clone().resize(s, s).png().toFile(`public/icons/icon-${s}.png`);
await mark.clone().resize(180, 180).png().toFile("public/apple-icon.png");
await mark.clone().resize(32, 32).png().toFile("src/app/icon.png");
await mark.clone().resize(512, 512).png().toFile("public/icons/maskable-512.png");
// Wordmark strip (bottom part)
await sharp(src).extract({ left: Math.round(W*0.12), top: Math.round(H*0.6), width: Math.round(W*0.76), height: Math.round(H*0.2) }).png().toFile("public/brand/wordmark.png");
// OG image 1200x630 : navy background with logo centered
const logoResized = await sharp(src).resize({ height: 520 }).png().toBuffer();
await sharp({ create: { width: 1200, height: 630, channels: 3, background: "#0E0B2E" } })
  .composite([{ input: logoResized, gravity: "centre" }])
  .jpeg({ quality: 88 })
  .toFile("public/og-default.jpg");
// Poster placeholder for hero (blurred logo gradient)
console.log("done");
