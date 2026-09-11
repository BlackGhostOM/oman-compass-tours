/**
 * Money helpers. All stored amounts are integers in **baisa** (1 OMR = 1000 baisa).
 */

export type Currency = "OMR" | "USD" | "EUR" | "GBP" | "AED" | "SAR";

/** Minor-unit exponent per currency (OMR uses 3 decimals). */
export const MINOR_UNITS: Record<Currency, number> = {
  OMR: 3,
  USD: 2,
  EUR: 2,
  GBP: 2,
  AED: 2,
  SAR: 2,
};

/**
 * Fallback display rates (1 OMR = x). Refreshed by the `fx.refresh` cron when
 * an FX API key is configured; otherwise these pegged approximations are used.
 * The Omani rial is pegged to the US dollar at 1 OMR = 2.6008 USD.
 */
export const FALLBACK_RATES: Record<Currency, number> = {
  OMR: 1,
  USD: 2.6008,
  EUR: 2.4,
  GBP: 2.05,
  AED: 9.55,
  SAR: 9.75,
};

export function omrToBaisa(omr: number): number {
  return Math.round(omr * 1000);
}

export function baisaToOmr(baisa: number): number {
  return baisa / 1000;
}

export function usdToBaisa(usd: number): number {
  return Math.round((usd / FALLBACK_RATES.USD) * 1000);
}

/** Convert baisa to the minor units of a target currency using a 1 OMR = rate quote. */
export function baisaToMinor(baisa: number, currency: Currency, rate: number): number {
  const major = (baisa / 1000) * rate;
  return Math.round(major * 10 ** MINOR_UNITS[currency]);
}

export function minorToMajor(minor: number, currency: Currency): number {
  return minor / 10 ** MINOR_UNITS[currency];
}

export function percentOf(baisa: number, percent: number): number {
  return Math.round((baisa * percent) / 100);
}
