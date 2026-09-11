import { ProviderError, type CheckoutRequest, type CheckoutResult, type NormalizedEvent, type PaymentProvider, type RefundRequest, type RefundResult, type RemoteStatus, type WebhookVerification } from "./provider";

/**
 * Thawani Pay (Oman) — hosted checkout, settled in OMR (baisa).
 * Docs: https://docs.thawani.om  (Checkout API v1)
 */
function baseUrl(): string {
  return process.env.THAWANI_MODE === "production" ? "https://checkout.thawani.om" : "https://uatcheckout.thawani.om";
}

function headers(): Record<string, string> {
  const key = process.env.THAWANI_SECRET_KEY;
  if (!key) throw new ProviderError("thawani", "THAWANI_SECRET_KEY is not configured");
  return { "Content-Type": "application/json", "thawani-api-key": key };
}

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${baseUrl()}/api/v1${path}`, { ...init, headers: { ...headers(), ...(init?.headers ?? {}) } });
  const json = (await res.json().catch(() => ({}))) as { success?: boolean; code?: number; description?: string; data?: T };
  if (!res.ok || json.success === false) {
    throw new ProviderError("thawani", json.description ?? `HTTP ${res.status}`, json);
  }
  return json.data as T;
}

type ThawaniSession = {
  session_id: string;
  client_reference_id: string;
  payment_status: "paid" | "unpaid" | "cancelled";
  total_amount: number;
  invoice?: string;
  metadata?: Record<string, string>;
};

type ThawaniPayment = { payment_id: string; status: string; amount: number; checkout_invoice: string };

export const thawaniProvider: PaymentProvider = {
  id: "thawani",
  supportedCurrencies: ["OMR"],
  settlementCurrency: () => "OMR",
  isConfigured: () => !!process.env.THAWANI_SECRET_KEY && !!process.env.THAWANI_PUBLISHABLE_KEY,

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const pub = process.env.THAWANI_PUBLISHABLE_KEY;
    if (!pub) throw new ProviderError("thawani", "THAWANI_PUBLISHABLE_KEY is not configured");
    const data = await api<ThawaniSession>("/checkout/session", {
      method: "POST",
      body: JSON.stringify({
        client_reference_id: req.paymentId,
        mode: "payment",
        products: [{ name: req.description.slice(0, 40), quantity: 1, unit_amount: req.amountMinor }],
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        customer_id: undefined,
        metadata: { ...req.metadata, paymentId: req.paymentId, bookingReference: req.bookingReference, email: req.customer.email, phone: req.customer.phone },
      }),
    });
    return { providerSessionId: data.session_id, checkoutUrl: `${baseUrl()}/pay/${data.session_id}?key=${pub}` };
  },

  /**
   * Thawani webhooks carry no HMAC signature that we rely on. We accept the
   * shared secret header when configured, and ALWAYS re-verify the session
   * status against the Thawani API before treating a payment as paid.
   */
  async verifyWebhook(request: Request): Promise<WebhookVerification> {
    const secret = process.env.THAWANI_WEBHOOK_SECRET;
    if (secret) {
      const got = request.headers.get("x-webhook-secret") ?? request.headers.get("thawani-webhook-secret") ?? new URL(request.url).searchParams.get("secret");
      if (got !== secret) return { ok: false, error: "Invalid webhook secret" };
    }
    let payload: { session_id?: string; client_reference_id?: string; event_type?: string; data?: { session_id?: string; client_reference_id?: string; payment_status?: string } };
    try {
      payload = (await request.json()) as typeof payload;
    } catch {
      return { ok: false, error: "Invalid JSON" };
    }
    const sessionId = payload.session_id ?? payload.data?.session_id;
    if (!sessionId) return { ok: false, error: "Missing session_id" };
    // Server-to-server verification (never trust the payload)
    const remote = await thawaniProvider.getStatus(sessionId);
    const eventId = `${sessionId}:${remote.status}`;
    const type: NormalizedEvent["type"] = remote.status === "succeeded" ? "payment.succeeded" : remote.status === "cancelled" ? "payment.cancelled" : remote.status === "failed" ? "payment.failed" : "ignored";
    return {
      ok: true,
      events: [{ eventId, type, rawType: payload.event_type ?? "session.update", providerSessionId: sessionId, providerPaymentId: remote.providerPaymentId, amountMinor: remote.amountMinor, currency: "OMR", raw: { payload, remote: remote.raw } }],
    };
  },

  async refund(req: RefundRequest): Promise<RefundResult> {
    try {
      let paymentId = req.providerPaymentId;
      if (!paymentId && req.providerSessionId) {
        const session = await api<ThawaniSession>(`/checkout/session/${req.providerSessionId}`);
        const payments = await api<ThawaniPayment[]>(`/payments?checkout_invoice=${session.invoice}`);
        paymentId = payments.find((p) => p.status === "Successful")?.payment_id ?? "";
      }
      if (!paymentId) return { status: "failed", error: "No Thawani payment id found for this session" };
      const data = await api<{ refund_id: string; status: string }>("/refunds", {
        method: "POST",
        body: JSON.stringify({ payment_id: paymentId, reason: req.reason.slice(0, 200), metadata: { idempotencyKey: req.idempotencyKey } }),
      });
      return { providerRefundId: data.refund_id, status: data.status?.toLowerCase().includes("success") ? "succeeded" : "pending", raw: data };
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  },

  async getStatus(providerSessionId: string): Promise<RemoteStatus> {
    const session = await api<ThawaniSession>(`/checkout/session/${providerSessionId}`);
    if (session.payment_status === "paid") {
      let providerPaymentId: string | undefined;
      try {
        const payments = await api<ThawaniPayment[]>(`/payments?checkout_invoice=${session.invoice}`);
        providerPaymentId = payments.find((p) => p.status === "Successful")?.payment_id;
      } catch {
        /* optional */
      }
      return { status: "succeeded", providerPaymentId, amountMinor: session.total_amount, currency: "OMR", raw: session };
    }
    if (session.payment_status === "cancelled") return { status: "cancelled", raw: session };
    return { status: "pending", raw: session };
  },
};
