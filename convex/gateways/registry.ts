import type { PaymentProvider, ProviderId } from "./provider";
import { stripeProvider } from "./stripe";
import { thawaniProvider } from "./thawani";
import { paypalProvider } from "./paypal";

const providers: Record<ProviderId, PaymentProvider> = {
  thawani: thawaniProvider,
  stripe: stripeProvider,
  paypal: paypalProvider,
};

export function getProvider(id: ProviderId): PaymentProvider {
  return providers[id];
}

export function configuredProviders(): ProviderId[] {
  return (Object.keys(providers) as ProviderId[]).filter((id) => providers[id].isConfigured());
}

/** Default provider for a visitor's country (GCC → Thawani, else Stripe). */
export function defaultProviderFor(countryCode: string | undefined, available: ProviderId[]): ProviderId {
  const gcc = ["OM", "AE", "SA", "QA", "KW", "BH"];
  if (countryCode && gcc.includes(countryCode.toUpperCase()) && available.includes("thawani")) return "thawani";
  if (available.includes("stripe")) return "stripe";
  return available[0] ?? "stripe";
}
