import { httpRouter } from "convex/server";
import { httpAction } from "./_generated/server";
import { internal } from "./_generated/api";
import { auth } from "./auth";
import { getProvider } from "./gateways/registry";
import type { ProviderId } from "./gateways/provider";

const http = httpRouter();

// Convex Auth routes (/api/auth/*)
auth.addHttpRoutes(http);

/**
 * Payment webhooks. Each provider adapter verifies the signature (or
 * re-verifies against the provider API) before any event is applied.
 * Processing is idempotent via the `webhookEvents` table.
 */
function webhookRoute(provider: ProviderId) {
  return httpAction(async (ctx, request) => {
    const adapter = getProvider(provider);
    const verification = await adapter.verifyWebhook(request);
    if (!verification.ok) {
      console.warn(`[webhook:${provider}] rejected: ${verification.error}`);
      return new Response(JSON.stringify({ error: verification.error }), { status: 400, headers: { "Content-Type": "application/json" } });
    }
    await ctx.runAction(internal.payments.processWebhook, { provider, events: verification.events });
    return new Response(JSON.stringify({ received: true, events: verification.events.length }), { status: 200, headers: { "Content-Type": "application/json" } });
  });
}

http.route({ path: "/webhooks/stripe", method: "POST", handler: webhookRoute("stripe") });
http.route({ path: "/webhooks/thawani", method: "POST", handler: webhookRoute("thawani") });
http.route({ path: "/webhooks/paypal", method: "POST", handler: webhookRoute("paypal") });

// Simple health check for uptime monitors
http.route({
  path: "/health",
  method: "GET",
  handler: httpAction(async () => new Response("ok", { status: 200 })),
});

export default http;
