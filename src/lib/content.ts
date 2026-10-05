import type { Locale } from "@/i18n/routing";
import { addDaysIso, isRealIsoDate, isoDayToInstant, omanTodayIso } from "../../convex/lib/dates";

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

/**
 * Formats a converted amount in another currency. By default an indicative whole-unit figure; pass fractionDigits
 * (the currency's minor units) for an exact amount such as the card charge.
 */
export function formatMoney(amountMajor: number, currency: string, locale: string, fractionDigits?: number): string {
  const digits = fractionDigits ?? (currency === "OMR" ? 3 : 0);
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en", {
    style: "currency",
    currency,
    minimumFractionDigits: fractionDigits !== undefined ? digits : undefined,
    maximumFractionDigits: digits,
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
/**
 * Which "up to N guests" line a product gets: private departures say "Private", shared group trips "Shared group",
 * and shared services (entry tickets) speak of tickets per booking.
 */
export function upToKey(tour: { kind?: string | null; departureType?: string | null }): "privateUpTo" | "sharedUpTo" | "ticketUpTo" {
  if (tour.departureType !== "shared") return "privateUpTo";
  return tour.kind === "service" ? "ticketUpTo" : "sharedUpTo";
}

export function decodeSlug(slug: string): string {
  try {
    return decodeURIComponent(slug);
  } catch {
    return slug;
  }
}

/** A date-only "YYYY-MM-DD" is an Oman calendar day: pin it to noon in Muscat so every viewer zone prints that same day. */
function toDisplayInstant(iso: string | number | Date): Date | null {
  if (typeof iso === "string" && /^\d{4}-\d{2}-\d{2}$/.test(iso)) return isRealIsoDate(iso) ? isoDayToInstant(iso) : null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDate(iso: string | number | Date, locale: string, style: "short" | "long" = "long"): string {
  const d = toDisplayInstant(iso);
  if (!d) return String(iso);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", {
    timeZone: "Asia/Muscat",
    ...(style === "long"
      ? { weekday: "long", day: "numeric", month: "long", year: "numeric" }
      : { day: "numeric", month: "short", year: "numeric" }),
  }).format(d);
}

/** An instant (epoch ms) as a date and time in Oman, e.g. a pay-by deadline: "6 Oct 2026, 06:30". */
export function formatOmanDateTime(ms: number, locale: string): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { timeZone: "Asia/Muscat", weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(ms));
}

export function formatHijri(iso: string, locale: string): string {
  const d = toDisplayInstant(iso);
  if (!d) return String(iso);
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-SA-u-ca-islamic-umalqura" : "en-u-ca-islamic-umalqura", {
    timeZone: "Asia/Muscat",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

/** Today's date in Oman (not UTC), so the bookable window flips at Muscat midnight for every visitor. */
export function todayIso(): string {
  return omanTodayIso();
}

export { addDaysIso };

/** Human wording for a free-cancellation window: hours below a week, otherwise days ("72 h", "30 days"). */
export function cancellationWindow(hours: number, locale: string): string {
  if (hours >= 168 && hours % 24 === 0) {
    const days = hours / 24;
    if (locale === "ar") return days === 1 ? "يوم واحد" : days === 2 ? "يومين" : days <= 10 ? `${days} أيام` : `${days} يومًا`;
    return `${days} days`;
  }
  return locale === "ar" ? `${hours} ساعة` : `${hours} h`;
}
