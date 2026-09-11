/**
 * Deep-merges a JSON patch into messages/<locale>.json.
 *   node scripts/merge-messages.mjs en patch.json
 * Used during development to add namespaces without rewriting whole files.
 */
import { readFileSync, writeFileSync } from "node:fs";

const [locale, patchPath] = process.argv.slice(2);
if (!locale || !patchPath) {
  console.error("usage: node scripts/merge-messages.mjs <locale> <patch.json>");
  process.exit(1);
}
const file = `messages/${locale}.json`;
const base = JSON.parse(readFileSync(file, "utf8"));
const patch = JSON.parse(readFileSync(patchPath, "utf8"));

function merge(a, b) {
  for (const [k, v] of Object.entries(b)) {
    if (v && typeof v === "object" && !Array.isArray(v) && a[k] && typeof a[k] === "object") merge(a[k], v);
    else a[k] = v;
  }
  return a;
}
writeFileSync(file, JSON.stringify(merge(base, patch), null, 2) + "\n");
console.log(`merged ${Object.keys(patch).join(", ")} into ${file}`);
