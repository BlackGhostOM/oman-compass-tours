/**
 * Generates the JWT_PRIVATE_KEY / JWKS pair required by Convex Auth and
 * prints (or sets) them on the current Convex deployment.
 *
 *   node scripts/generate-auth-keys.mjs            # print
 *   node scripts/generate-auth-keys.mjs --set         # npx convex env set … (dev deployment)
 *   node scripts/generate-auth-keys.mjs --set --prod  # same, targeting the production deployment
 */
import { exportJWK, exportPKCS8, generateKeyPair } from "jose";
import { execSync } from "node:child_process";

const keys = await generateKeyPair("RS256", { extractable: true });
const privateKey = await exportPKCS8(keys.privateKey);
const publicKey = await exportJWK(keys.publicKey);
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicKey }] });

const privateKeyOneLine = privateKey.trimEnd().replace(/\n/g, " ");

if (process.argv.includes("--set")) {
  const target = process.argv.includes("--prod") ? "--prod " : "";
  execSync(`npx convex env set ${target}JWT_PRIVATE_KEY -- "${privateKeyOneLine}"`, { stdio: "inherit" });
  execSync(`npx convex env set ${target}JWKS -- '${jwks}'`, { stdio: "inherit", shell: process.platform === "win32" ? "bash" : undefined });
  console.log("JWT_PRIVATE_KEY and JWKS set on the Convex deployment.");
} else {
  console.log(`JWT_PRIVATE_KEY="${privateKeyOneLine}"`);
  console.log(`JWKS='${jwks}'`);
}
