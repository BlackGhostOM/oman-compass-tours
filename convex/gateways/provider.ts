/**
 * Provider-agnostic payment interface. Every gateway (Thawani, Stripe, PayPal)
 * implements this contract; the rest of the app never talks to a gateway
 * directly. Amounts are integers in the provider currency's minor units.
 */
import type { Currency } from "../lib/money";

export type ProviderId = "thawani" | "stripe" | "paypal";

export type CheckoutRequest = {
  paymentId: string;
  bookingReference: string;
  amountMinor: number;
  currency: Currency;
  description: string;
  customer: { email: string; name: string; phone: string };
  successUrl: string;
  cancelUrl: string;
  locale: "en" | "ar";
  metadata: Record<string, string>;
  idempotencyKey: string;
};

export type CheckoutResult = {
  providerSessionId: string;
  checkoutUrl: string;
  providerCustomerId?: string;
};

export type NormalizedEventType =
  | "payment.succeeded"
  | "payment.failed"
  | "payment.cancelled"
  | "refund.succeeded"
  | "refund.failed"
  | "ignored";

export type NormalizedEvent = {
  eventId: string;
  type: NormalizedEventType;
  rawType: string;
  providerSessionId?: string;
  providerPaymentId?: string;
  providerRefundId?: string;
  amountMinor?: number;
  currency?: string;
  raw: unknown;
};

export type WebhookVerification = { ok: true; events: NormalizedEvent[] } | { ok: false; error: string };

export type RefundRequest = {
  providerPaymentId: string;
  providerSessionId?: string;
  amountMinor: number;
  currency: Currency;
  reason: string;
  idempotencyKey: string;
};

export type RefundResult = { providerRefundId?: string; status: "succeeded" | "pending" | "failed"; error?: string; raw?: unknown };

export type RemoteStatus = { status: "succeeded" | "pending" | "failed" | "cancelled" | "unknown"; providerPaymentId?: string; amountMinor?: number; currency?: string; raw?: unknown };

export interface PaymentProvider {
  readonly id: ProviderId;
  readonly supportedCurrencies: Currency[];
  readonly settlementCurrency: (requested: Currency) => Currency;
  isConfigured(): boolean;
  createCheckout(req: CheckoutRequest): Promise<CheckoutResult>;
  verifyWebhook(request: Request): Promise<WebhookVerification>;
  refund(req: RefundRequest): Promise<RefundResult>;
  /** Server-to-server status lookup (reconciliation / optional API verification). */
  getStatus(providerSessionId: string): Promise<RemoteStatus>;
}

export class ProviderError extends Error {
  constructor(
    public provider: ProviderId,
    message: string,
    public details?: unknown,
  ) {
    super(`[${provider}] ${message}`);
  }
}
