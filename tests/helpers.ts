import { createHmac } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";

/** Reads a value from .env.local (Playwright runs outside Next's env loading). */
export function envLocal(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const text = readFileSync(".env.local", "utf8");
    const line = text.split(/\r?\n/).find((l) => l.startsWith(`${name}=`));
    return line?.slice(name.length + 1).trim();
  } catch {
    return undefined;
  }
}

export const convexSiteUrl = () => envLocal("NEXT_PUBLIC_CONVEX_SITE_URL") ?? "http://127.0.0.1:3211";

/** Runs a Convex function through the CLI (works for internal functions on dev deployments). */
export function convexRun<T = unknown>(fn: string, args: Record<string, unknown> = {}): T {
  // Invoke the CLI entry point directly with node so JSON quoting survives on Windows.
  const bin = path.join(process.cwd(), "node_modules", "convex", "bin", "main.js");
  const out = execFileSync(process.execPath, [bin, "run", fn, JSON.stringify(args)], {
    encoding: "utf8",
    env: { ...process.env, CONVEX_AGENT_MODE: process.env.CONVEX_AGENT_MODE ?? "anonymous" },
  });
  const jsonStart = out.indexOf("{");
  const jsonArr = out.indexOf("[");
  const start = jsonStart === -1 ? jsonArr : jsonArr === -1 ? jsonStart : Math.min(jsonStart, jsonArr);
  if (start === -1) return (out.trim() === "null" ? null : out.trim()) as T;
  return JSON.parse(out.slice(start)) as T;
}

/** Builds a Stripe-signature header for a raw payload (same scheme Stripe uses). */
export function stripeSignature(payload: string, secret: string, timestamp = Math.floor(Date.now() / 1000)): string {
  const signed = createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex");
  return `t=${timestamp},v1=${signed}`;
}

/** Minimal `checkout.session.completed` event body. */
export function stripeCheckoutCompletedEvent(sessionId: string, amountTotal: number, currency: string, paymentIntent = `pi_test_${Date.now()}`) {
  return {
    id: `evt_test_${Date.now()}`,
    object: "event",
    api_version: "2024-06-20",
    created: Math.floor(Date.now() / 1000),
    type: "checkout.session.completed",
    livemode: false,
    pending_webhooks: 1,
    request: { id: null, idempotency_key: null },
    data: {
      object: {
        id: sessionId,
        object: "checkout.session",
        payment_status: "paid",
        status: "complete",
        amount_total: amountTotal,
        currency: currency.toLowerCase(),
        payment_intent: paymentIntent,
        mode: "payment",
      },
    },
  };
}

export const testTraveller = {
  firstName: "Test",
  lastName: "Traveller",
  email: `qa+${Date.now()}@example.com`,
  phoneNational: "92255028",
};

/** The DEV Convex deployment the app under test talks to (never production). */
export function convexCloudUrl(): string {
  const url = envLocal("NEXT_PUBLIC_CONVEX_URL") ?? "";
  if (!url || url.includes("fantastic-sturgeon-674")) throw new Error(`Refusing to run against ${url || "an unknown deployment"}: tests use the DEV deployment only`);
  return url.replace(/\/$/, "");
}

/** Calls a public Convex query or mutation over the HTTP API. Throws with the error data when the call fails. */
export async function convexHttp<T = unknown>(kind: "query" | "mutation", path: string, args: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${convexCloudUrl()}/api/${kind}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ path, args, format: "json" }),
  });
  const body = (await res.json()) as { status: string; value?: T; errorMessage?: string; errorData?: unknown };
  if (body.status !== "success") {
    const err = new Error(`${path}: ${body.errorMessage ?? res.status}`) as Error & { data?: unknown };
    err.data = body.errorData;
    throw err;
  }
  return body.value as T;
}

/** A fresh anonymous session key in the app's own format (see use-session-key.ts). */
export function testSessionKey(): string {
  return "s_qa" + Math.random().toString(36).slice(2, 14) + Date.now().toString(36);
}
