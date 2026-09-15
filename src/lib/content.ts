import type { Locale } from "@/i18n/routing";

export type LocalizedString = { en: string; ar: string };

/** Picks the localized value with a fallback to English. */
export function pick(value: LocalizedString | undefined | null, locale: string): string {
  if (!value) return "";
  const l = (locale === "ar" ? "ar" : "en") as Locale;
  return value[l] || value.en || "";
}

/** Formats baisa as OMR (e.g. 88.000 OMR / ٨٨٫٠٠٠ ر.ع.). */
export function formatOmr(baisa: number, locale: string, opts: { compact?: boolean } = {}): string {
  const omr = baisa / 1000;
  const fractionDigits = opts.compact && Number.isInteger(omr) ? 0 : 3;
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", {
    style: "currency",
    currency: "OMR",
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  }).format(omr);
}

/** Formats a converted display amount in another currency. */
export function formatMoney(amountMajor: number, currency: string, locale: string): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en", {
    style: "currency",
    currency,
    maximumFractionDigits: currency === "OMR" ? 3 : 0,
  }).format(amountMajor);
}

export function baisaToOmr(baisa: number): number {
  return baisa / 1000;
}

/** Duration label from minutes when no localized label exists. */
export function durationFromMinutes(minutes: number, locale: string): string {
  if (minutes >= 1440) {
    const days = Math.round(minutes / 1440);
    return locale === "ar" ? `${days} أيام` : `${days} days`;
  }
  const hours = Math.round(minutes / 60);
  return locale === "ar" ? `${hours} ساعات` : `${hours} hours`;
}

/** Decodes a slug that may be percent-encoded (Arabic slugs). */
export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

export function formatDate(iso: string | number | Date, locale: string, style: "short" | "long" = "long"): string {
  const d = typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso) ? new Date(iso + "T00:00:00") : new Date(iso);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
    timeZone: "Asia/Muscat",
    ...(style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" }),
  }).format(d);
}

export function formatHijri(iso: string, locale: string): string {
  const d = new Date(iso + "T00:00:00");
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function addDaysIso(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Human wording for a free-cancellation window: hours below a week, otherwise days ("72 h", "30 days"). */
export function cancellationWindow(hours: number, locale: string): string {
  if (hours >= 168 && hours % 24 === 0) {
    const days = hours / 24;
    if (locale === "ar") return days === 1 ? "يوم واحد" : days === 2 ? "يومين" : days <= 10 ? `${days} أيام` : `${days} يومًا`;
    return `${days} days`;
  }
  return locale === "ar" ? `${hours} ساعة` : `${hours} h`;
}
