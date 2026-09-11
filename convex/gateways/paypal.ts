import type { Currency } from "../lib/money";
import { minorToMajor } from "../lib/money";
import { ProviderError, type CheckoutRequest, type CheckoutResult, type NormalizedEvent, type PaymentProvider, type RefundRequest, type RefundResult, type RemoteStatus, type WebhookVerification } from "./provider";

/** PayPal Orders v2 (REST). Settles in USD/EUR/GBP. */
function baseUrl(): string {
  return process.env.PAYPAL_MODE === "live" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

async function accessToken(): Promise<string> {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new ProviderError("paypal", "PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET are not configured");
  const res = await fetch(`${baseUrl()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${btoa(`${id}:${secret}`)}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials",
  });
  const json = (await res.json()) as { access_token?: string; error_description?: string };
  if (!res.ok || !json.access_token) throw new ProviderError("paypal", json.error_description ?? `OAuth failed (${res.status})`);
  return json.access_token;
}

async function api<T>(path: string, init: RequestInit & { idempotencyKey?: string } = {}): Promise<T> {
  const token = await accessToken();
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(init.idempotencyKey ? { "PayPal-Request-Id": init.idempotencyKey } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  const json = text ? (JSON.parse(text) as T & { message?: string; details?: unknown }) : ({} as T);
  if (!res.ok) throw new ProviderError("paypal", (json as { message?: string }).message ?? `HTTP ${res.status}`, json);
  return json;
}

type Order = {
  id: string;
  status: string;
  links?: { rel: string; href: string }[];
  purchase_units?: { reference_id?: string; custom_id?: string; payments?: { captures?: { id: string; status: string; amount: { value: string; currency_code: string } }[] } }[];
};

export const paypalProvider: PaymentProvider = {
  id: "paypal",
  supportedCurrencies: ["USD", "EUR", "GBP"],
  settlementCurrency: (requested: Currency) => (requested === "EUR" || requested === "GBP" ? requested : "USD"),
  isConfigured: () => !!process.env.PAYPAL_CLIENT_ID && !!process.env.PAYPAL_CLIENT_SECRET,

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const order = await api<Order>("/v2/checkout/orders", {
      method: "POST",
      idempotencyKey: req.idempotencyKey,
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [
          {
            reference_id: req.paymentId,
            custom_id: req.bookingReference,
            description: req.description.slice(0, 127),
            amount: { currency_code: req.currency, value: minorToMajor(req.amountMinor, req.currency).toFixed(2) },
          },
        ],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: "Oman Compass Tours",
              locale: req.locale === "ar" ? "ar-EG" : "en-US",
              user_action: "PAY_NOW",
              shipping_preference: "NO_SHIPPING",
              return_url: req.successUrl,
              cancel_url: req.cancelUrl,
            },
          },
        },
      }),
    });
    const approve = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve")?.href;
    if (!approve) throw new ProviderError("paypal", "No approval link returned", order);
    return { providerSessionId: order.id, checkoutUrl: approve };
  },

  async verifyWebhook(request: Request): Promise<WebhookVerification> {
    const webhookId = process.env.PAYPAL_WEBHOOK_ID;
    if (!webhookId) return { ok: false, error: "PAYPAL_WEBHOOK_ID is not configured" };
    const body = await request.text();
    let event: { id: string; event_type: string; resource?: Record<string, unknown> };
    try {
      event = JSON.parse(body);
    } catch {
      return { ok: false, error: "Invalid JSON" };
    }
    const h = (n: string) => request.headers.get(n) ?? "";
    let verification: { verification_status?: string };
    try {
      verification = await api<{ verification_status?: string }>("/v1/notifications/verify-webhook-signature", {
        method: "POST",
        body: JSON.stringify({
          auth_algo: h("paypal-auth-algo"),
          cert_url: h("paypal-cert-url"),
          transmission_id: h("paypal-transmission-id"),
          transmission_sig: h("paypal-transmission-sig"),
          transmission_time: h("paypal-transmission-time"),
          webhook_id: webhookId,
          webhook_event: event,
        }),
      });
    } catch (err) {
      return { ok: false, error: `Verification call failed: ${(err as Error).message}` };
    }
    if (verification.verification_status !== "SUCCESS") return { ok: false, error: "Signature verification failed" };
    return { ok: true, events: [normalize(event)] };
  },

  async refund(req: RefundRequest): Promise<RefundResult> {
    try {
      const data = await api<{ id: string; status: string }>(`/v2/payments/captures/${req.providerPaymentId}/refund`, {
        method: "POST",
        idempotencyKey: req.idempotencyKey,
        body: JSON.stringify({ amount: { value: minorToMajor(req.amountMinor, req.currency).toFixed(2), currency_code: req.currency }, note_to_payer: req.reason.slice(0, 255) }),
      });
      return { providerRefundId: data.id, status: data.status === "COMPLETED" ? "succeeded" : data.status === "PENDING" ? "pending" : "failed", raw: data };
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  },

  async getStatus(orderId: string): Promise<RemoteStatus> {
    const order = await api<Order>(`/v2/checkout/orders/${orderId}`);
    const capture = order.purchase_units?.[0]?.payments?.captures?.find((c) => c.status === "COMPLETED");
    if (capture) return { status: "succeeded", providerPaymentId: capture.id, amountMinor: Math.round(Number(capture.amount.value) * 100), currency: capture.amount.currency_code, raw: order };
    if (order.status === "VOIDED") return { status: "cancelled", raw: order };
    return { status: "pending", raw: order };
  },
};

/** Captures an approved order (called from the return URL). */
export async function capturePaypalOrder(orderId: string): Promise<RemoteStatus> {
  const order = await api<Order>(`/v2/checkout/orders/${orderId}/capture`, { method: "POST", idempotencyKey: `capture-${orderId}` });
  const capture = order.purchase_units?.[0]?.payments?.captures?.[0];
  if (order.status === "COMPLETED" && capture) {
    return { status: capture.status === "COMPLETED" ? "succeeded" : "pending", providerPaymentId: capture.id, amountMinor: Math.round(Number(capture.amount.value) * 100), currency: capture.amount.currency_code, raw: order };
  }
  return { status: "pending", raw: order };
}

function normalize(event: { id: string; event_type: string; resource?: Record<string, unknown> }): NormalizedEvent {
  const base = { eventId: event.id, rawType: event.event_type, raw: event };
  const r = (event.resource ?? {}) as { id?: string; status?: string; amount?: { value?: string; currency_code?: string }; supplementary_data?: { related_ids?: { order_id?: string } }; custom_id?: string };
  const orderId = r.supplementary_data?.related_ids?.order_id;
  const amountMinor = r.amount?.value ? Math.round(Number(r.amount.value) * 100) : undefined;
  switch (event.event_type) {
    case "PAYMENT.CAPTURE.COMPLETED":
      return { ...base, type: "payment.succeeded", providerSessionId: orderId, providerPaymentId: r.id, amountMinor, currency: r.amount?.currency_code };
    case "PAYMENT.CAPTURE.DENIED":
    case "PAYMENT.CAPTURE.DECLINED":
      return { ...base, type: "payment.failed", providerSessionId: orderId, providerPaymentId: r.id };
    case "PAYMENT.CAPTURE.REFUNDED":
      return { ...base, type: "refund.succeeded", providerPaymentId: r.id, amountMinor, currency: r.amount?.currency_code };
    case "CHECKOUT.ORDER.VOIDED":
      return { ...base, type: "payment.cancelled", providerSessionId: r.id };
    default:
      return { ...base, type: "ignored" };
  }
}
