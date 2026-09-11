/**
 * Generates on-brand placeholder imagery (gradients + compass hairlines) so the
 * catalog renders before real photography is uploaded through the admin panel.
 *   node scripts/placeholders.mjs
 */
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const out = "public/media/placeholders";
mkdirSync(out, { recursive: true });

/** [key, top colour, bottom colour, accent] */
const scenes = [
  ["hero", "#0E0B2E", "#1E1A4F", "#C9A15C"],
  ["muscat", "#14113A", "#3B5C8A", "#DDB97A"],
  ["nizwa", "#2B1E14", "#8A5A2B", "#DDB97A"],
  ["wahiba", "#7A3A1E", "#D9962B", "#F6EFE2"],
  ["jebel-akhdar", "#14322B", "#2E8B6B", "#DDB97A"],
  ["salalah", "#1E3B2A", "#5C8A4A", "#F6EFE2"],
  ["musandam", "#0E1E3A", "#2A5C7A", "#DDB97A"],
  ["sur", "#123A4A", "#2A7A8A", "#F6EFE2"],
  ["wadi-shab", "#0E3A3A", "#1E9A8A", "#F6EFE2"],
  ["dinner", "#3A1E0E", "#A8843F", "#F6EFE2"],
  ["team-1", "#0E0B2E", "#2A2566", "#C9A15C"],
  ["team-2", "#14113A", "#3A2566", "#C9A15C"],
  ["team-3", "#1E1A4F", "#2A2566", "#C9A15C"],
  ["office-1", "#14113A", "#1E1A4F", "#C9A15C"],
  ["office-2", "#0E0B2E", "#14113A", "#C9A15C"],
  ["about", "#0E0B2E", "#3B5C8A", "#C9A15C"],
  ["reel-1", "#7A3A1E", "#0E0B2E", "#DDB97A"],
  ["reel-2", "#0E3A3A", "#0E0B2E", "#DDB97A"],
  ["reel-3", "#14322B", "#0E0B2E", "#DDB97A"],
  ["reel-4", "#3B5C8A", "#0E0B2E", "#DDB97A"],
];

function svg(w, h, top, bottom, accent, key) {
  const cx = w * 0.72;
  const cy = h * 0.38;
  const r = Math.min(w, h) * 0.32;
  const sun = `<circle cx="${w * 0.28}" cy="${h * 0.34}" r="${Math.min(w, h) * 0.09}" fill="${accent}" opacity="0.28"/>`;
  const rays = Array.from({ length: 12 })
    .map((_, i) => {
      const a = (i / 12) * Math.PI * 2;
      const x1 = w * 0.28 + Math.cos(a) * Math.min(w, h) * 0.12;
      const y1 = h * 0.34 + Math.sin(a) * Math.min(w, h) * 0.12;
      const x2 = w * 0.28 + Math.cos(a) * Math.min(w, h) * 0.2;
      const y2 = h * 0.34 + Math.sin(a) * Math.min(w, h) * 0.2;
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${accent}" stroke-width="1.2" opacity="0.35"/>`;
    })
    .join("");
  const dunes = `<path d="M0 ${h * 0.72} C ${w * 0.2} ${h * 0.6}, ${w * 0.35} ${h * 0.82}, ${w * 0.55} ${h * 0.7} S ${w * 0.85} ${h * 0.62}, ${w} ${h * 0.74} L ${w} ${h} L 0 ${h} Z" fill="#000" opacity="0.18"/>
  <path d="M0 ${h * 0.82} C ${w * 0.25} ${h * 0.74}, ${w * 0.45} ${h * 0.92}, ${w * 0.7} ${h * 0.8} S ${w * 0.9} ${h * 0.76}, ${w} ${h * 0.86} L ${w} ${h} L 0 ${h} Z" fill="#000" opacity="0.22"/>`;
  const compass = `<g stroke="${accent}" stroke-width="1" fill="none" opacity="0.22">
    <circle cx="${cx}" cy="${cy}" r="${r}"/><circle cx="${cx}" cy="${cy}" r="${r * 0.86}"/>
    <path d="M${cx} ${cy - r * 1.3} L${cx + r * 0.12} ${cy - r * 0.12} L${cx} ${cy} L${cx - r * 0.12} ${cy - r * 0.12} Z"/>
    <path d="M${cx} ${cy + r * 1.3} L${cx + r * 0.12} ${cy + r * 0.12} L${cx} ${cy} L${cx - r * 0.12} ${cy + r * 0.12} Z"/>
    <path d="M${cx - r * 1.3} ${cy} L${cx - r * 0.12} ${cy - r * 0.12} L${cx} ${cy} L${cx - r * 0.12} ${cy + r * 0.12} Z"/>
    <path d="M${cx + r * 1.3} ${cy} L${cx + r * 0.12} ${cy - r * 0.12} L${cx} ${cy} L${cx + r * 0.12} ${cy + r * 0.12} Z"/>
  </g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
  <defs><linearGradient id="g" x1="0" y1="0" x2="0.4" y2="1"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${bottom}"/></linearGradient>
  <radialGradient id="v" cx="0.5" cy="0.5" r="0.75"><stop offset="0.6" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity="0.45"/></radialGradient></defs>
  <rect width="${w}" height="${h}" fill="url(#g)"/>${sun}${rays}${dunes}${compass}
  <rect width="${w}" height="${h}" fill="url(#v)"/>
  <line x1="${w * 0.08}" y1="${h * 0.93}" x2="${w * 0.3}" y2="${h * 0.93}" stroke="${accent}" stroke-width="1" opacity="0.6"/>
  <!-- ${key} -->
</svg>`;
}

for (const [key, top, bottom, accent] of scenes) {
  const wide = key.startsWith("reel") ? [1080, 1920] : key.startsWith("team") ? [900, 1100] : [1600, 1000];
  const [w, h] = wide;
  await sharp(Buffer.from(svg(w, h, top, bottom, accent, key)))
    .jpeg({ quality: 82, mozjpeg: true })
    .toFile(`${out}/${key}.jpg`);
  // tiny blur placeholder (base64) is computed at seed time from this file
  console.log("✓", key, `${w}x${h}`);
}
