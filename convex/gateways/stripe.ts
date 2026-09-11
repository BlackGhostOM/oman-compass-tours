import Stripe from "stripe";
import type { Currency } from "../lib/money";
import { ProviderError, type CheckoutRequest, type CheckoutResult, type NormalizedEvent, type PaymentProvider, type RefundRequest, type RefundResult, type RemoteStatus, type WebhookVerification } from "./provider";

function client(): Stripe {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new ProviderError("stripe", "STRIPE_SECRET_KEY is not configured");
  return new Stripe(key, {
    httpClient: Stripe.createFetchHttpClient(),
    typescript: true,
  });
}

const cryptoProvider = Stripe.createSubtleCryptoProvider();

/**
 * Stripe Checkout (hosted). Cards, Apple Pay and Google Pay are enabled
 * automatically on the hosted page. OMR is not settled by Stripe, so the
 * settlement currency is USD/EUR/GBP.
 */
export const stripeProvider: PaymentProvider = {
  id: "stripe",
  supportedCurrencies: ["USD", "EUR", "GBP", "AED", "SAR"],
  settlementCurrency: (requested: Currency) => (requested === "OMR" ? "USD" : requested),
  isConfigured: () => !!process.env.STRIPE_SECRET_KEY,

  async createCheckout(req: CheckoutRequest): Promise<CheckoutResult> {
    const stripe = client();
    const session = await stripe.checkout.sessions.create(
      {
        mode: "payment",
        customer_email: req.customer.email,
        client_reference_id: req.bookingReference,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: req.currency.toLowerCase(),
              unit_amount: req.amountMinor,
              product_data: { name: req.description, metadata: { bookingReference: req.bookingReference } },
            },
          },
        ],
        payment_method_types: ["card"],
        locale: req.locale === "ar" ? "ar" : "en",
        success_url: req.successUrl,
        cancel_url: req.cancelUrl,
        metadata: { ...req.metadata, paymentId: req.paymentId, bookingReference: req.bookingReference },
        payment_intent_data: { description: req.description, metadata: { paymentId: req.paymentId, bookingReference: req.bookingReference } },
        expires_at: Math.floor(Date.now() / 1000) + 60 * 60, // 1 hour
      },
      { idempotencyKey: req.idempotencyKey },
    );
    if (!session.url) throw new ProviderError("stripe", "Checkout session has no URL", session);
    return { providerSessionId: session.id, checkoutUrl: session.url };
  },

  async verifyWebhook(request: Request): Promise<WebhookVerification> {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) return { ok: false, error: "STRIPE_WEBHOOK_SECRET is not configured" };
    const signature = request.headers.get("stripe-signature");
    if (!signature) return { ok: false, error: "Missing stripe-signature header" };
    const body = await request.text();
    let event: Stripe.Event;
    try {
      event = await Stripe.webhooks.constructEventAsync(body, signature, secret, undefined, cryptoProvider);
    } catch (err) {
      return { ok: false, error: `Signature verification failed: ${(err as Error).message}` };
    }
    return { ok: true, events: [normalize(event)] };
  },

  async refund(req: RefundRequest): Promise<RefundResult> {
    const stripe = client();
    try {
      const refund = await stripe.refunds.create(
        { payment_intent: req.providerPaymentId, amount: req.amountMinor, reason: "requested_by_customer", metadata: { reason: req.reason.slice(0, 200) } },
        { idempotencyKey: req.idempotencyKey },
      );
      return { providerRefundId: refund.id, status: refund.status === "succeeded" ? "succeeded" : refund.status === "failed" ? "failed" : "pending", raw: refund };
    } catch (err) {
      return { status: "failed", error: (err as Error).message };
    }
  },

  async getStatus(providerSessionId: string): Promise<RemoteStatus> {
    const stripe = client();
    const session = await stripe.checkout.sessions.retrieve(providerSessionId);
    const pi = typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id;
    if (session.payment_status === "paid") return { status: "succeeded", providerPaymentId: pi, amountMinor: session.amount_total ?? undefined, currency: session.currency?.toUpperCase(), raw: session };
    if (session.status === "expired") return { status: "cancelled", raw: session };
    return { status: "pending", providerPaymentId: pi, raw: session };
  },
};

function normalize(event: Stripe.Event): NormalizedEvent {
  const base = { eventId: event.id, rawType: event.type, raw: event };
  switch (event.type) {
    case "checkout.session.completed":
    case "checkout.session.async_payment_succeeded": {
      const s = event.data.object;
      if (s.payment_status !== "paid") return { ...base, type: "ignored", providerSessionId: s.id };
      return {
        ...base,
        type: "payment.succeeded",
        providerSessionId: s.id,
        providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : s.payment_intent?.id,
        amountMinor: s.amount_total ?? undefined,
        currency: s.currency?.toUpperCase(),
      };
    }
    case "checkout.session.async_payment_failed": {
      const s = event.data.object;
      return { ...base, type: "payment.failed", providerSessionId: s.id, providerPaymentId: typeof s.payment_intent === "string" ? s.payment_intent : undefined };
    }
    case "checkout.session.expired": {
      const s = event.data.object;
      return { ...base, type: "payment.cancelled", providerSessionId: s.id };
    }
    case "payment_intent.payment_failed": {
      const pi = event.data.object;
      return { ...base, type: "payment.failed", providerPaymentId: pi.id };
    }
    case "charge.refunded": {
      const c = event.data.object;
      return {
        ...base,
        type: "refund.succeeded",
        providerPaymentId: typeof c.payment_intent === "string" ? c.payment_intent : c.payment_intent?.id,
        amountMinor: c.amount_refunded,
        currency: c.currency.toUpperCase(),
        providerRefundId: c.refunds?.data?.[0]?.id,
      };
    }
    default:
      return { ...base, type: "ignored" };
  }
}
