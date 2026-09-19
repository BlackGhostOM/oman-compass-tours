import { escapeHtml, layout } from "./email";
import { markdownToEmailHtml } from "./markdown";

/**
 * Welcome newsletter: intro text, one featured "hero" journey with its cover
 * photo, highlights, rating and price, then up to three recommended tours as
 * cards that mirror the website's tour cards. Table-based HTML with inline
 * styles so it renders in Gmail, Outlook and Apple Mail; images are served
 * through the site's image optimizer at email-friendly sizes.
 */
export type Locale = "en" | "ar";
type Localized = { en: string; ar: string };

export type WelcomeTour = {
  code: string;
  title: Localized;
  slug: Localized;
  summary: Localized;
  highlights: Localized[];
  durationLabel: Localized;
  durationDays: number;
  maxGroup: number;
  freeCancellationHours: number;
  priceFrom: number; // baisa
  pricingModel: string; // "per_group" | "per_person"
  ratingAverage: number;
  ratingCount: number;
  externalReviewCount?: number;
  coverUrl?: string;
};

const USD_RATE = 2.6008; // OMR is pegged to the dollar; the same figure the site's price tag uses
const C = { navy: "#0E0B2E", ink: "#1B1830", ink500: "#6B6880", sand: "#F6EFE2", sand200: "#E6DCC8", gold: "#C9A15C", green: "#1f6f50" };
const GOLD_GRADIENT = "linear-gradient(135deg,#DDB97A,#C9A15C,#A8843F)";
const SERIF = "Cinzel,Georgia,'Times New Roman',serif";
const SANS = "Inter,Arial,'Segoe UI',Tahoma,sans-serif";

const T = {
  en: {
    kicker: "Our most-loved journey",
    more: "More journeys you may like",
    seeItinerary: "See the full itinerary",
    view: "View details",
    from: "From",
    perAdult: "per adult",
    perGroup: "per private group",
    upTo: (n: number) => `up to ${n} guests`,
    freeCancel: "Free cancellation",
    browse: "Browse all tours",
    questions: "Questions? WhatsApp us any time on",
    footer: (u: string) => `You receive this because you subscribed to Oman Compass Tours travel notes. <a href="${u}" style="color:#DDB97A">Unsubscribe</a>`,
  },
  ar: {
    kicker: "جولتنا الأكثر حبًا لدى ضيوفنا",
    more: "جولات أخرى قد تعجبك",
    seeItinerary: "اطّلع على البرنامج الكامل",
    view: "عرض التفاصيل",
    from: "ابتداءً من",
    perAdult: "للبالغ",
    perGroup: "للمجموعة الخاصة",
    upTo: (n: number) => `حتى ${n} ضيوف`,
    freeCancel: "إلغاء مجاني",
    browse: "تصفّح كل الجولات",
    questions: "لأي سؤال، راسلنا على واتساب:",
    footer: (u: string) => `تصلك هذه الرسالة لأنك اشتركت في نشرة بوصلة عُمان للسياحة. <a href="${u}" style="color:#DDB97A">إلغاء الاشتراك</a>`,
  },
};

const thousands = (n: number) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const omr = (baisa: number) => (baisa % 1000 === 0 ? String(baisa / 1000) : (baisa / 1000).toFixed(3));
const usd = (baisa: number) => thousands(Math.round((baisa / 1000) * USD_RATE));
const pick = (l: Localized, locale: Locale) => l[locale] || l.en;
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return s.slice(0, cut > max / 2 ? cut : max).replace(/[،,;:\s]+$/, "") + "…";
}
/** Cover-cropped JPEG of a photo at exactly w×h (2× the displayed size for sharp phones), via the site's /api/email-image route. */
const img = (siteUrl: string, coverUrl: string | undefined, w: number, h: number) => (coverUrl ? `${siteUrl}/api/email-image?src=${encodeURIComponent(coverUrl)}&w=${w}&h=${h}` : undefined);
const tourUrl = (siteUrl: string, locale: Locale, t: WelcomeTour) => `${siteUrl}/${locale}/tours/${encodeURIComponent(pick(t.slug, locale))}`;

function stars(t: WelcomeTour): string {
  const count = t.ratingCount + (t.externalReviewCount ?? 0);
  const n = Math.max(1, Math.min(5, Math.round(t.ratingAverage || 5)));
  return `<span style="color:${C.gold};letter-spacing:1px">${"★".repeat(n)}</span> <span style="font-weight:700;color:${C.ink}">${(t.ratingAverage || 5).toFixed(1)}</span>${count ? ` <span style="color:${C.ink500}">(${count})</span>` : ""}`;
}

function price(t: WelcomeTour, locale: Locale, big: boolean): string {
  const tr = T[locale];
  return `<div style="font-family:${SANS};font-size:11px;color:${C.ink500}">${tr.from}</div>
<div dir="ltr" style="display:inline-block;font-family:${SERIF};font-size:${big ? 24 : 17}px;line-height:1.2;font-weight:700;color:${C.navy}">OMR ${omr(t.priceFrom)}</div>
<div style="font-family:${SANS};font-size:11px;color:${C.ink500}">${t.pricingModel === "per_group" ? tr.perGroup : tr.perAdult} · <span dir="ltr">≈ $${usd(t.priceFrom)}</span></div>`;
}

function button(href: string, label: string, size: "sm" | "lg"): string {
  return `<a href="${href}" style="display:block;text-align:center;padding:${size === "lg" ? "13px 20px" : "9px 10px"};border-radius:10px;background:${C.gold};background-image:${GOLD_GRADIENT};color:${C.navy};font-family:${SANS};font-weight:700;font-size:${size === "lg" ? 15 : 12}px;text-decoration:none">${label}</a>`;
}

const pill = (text: string) => `<span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${C.navy};color:${C.sand};font-family:${SANS};font-size:11px;font-weight:600">${text}</span>`;

function hero(t: WelcomeTour, locale: Locale, siteUrl: string): string {
  const tr = T[locale];
  const align = locale === "ar" ? "right" : "left";
  const D = locale === "ar" ? ' dir="rtl"' : "";
  const url = tourUrl(siteUrl, locale, t);
  const src = img(siteUrl, t.coverUrl, 1344, 806); // 5:3 banner, ~1.5× the 896px content width
  const dur = escapeHtml(pick(t.durationLabel, locale));
  const highlights = t.highlights
    .slice(0, 4)
    .map((h) => `<tr><td style="padding:3px 0;font-family:${SANS};font-size:13px;line-height:1.5;color:${C.ink};text-align:${align}"><span style="color:${C.gold}">◆</span>&nbsp; ${escapeHtml(pick(h, locale))}</td></tr>`)
    .join("");
  return `
<div style="text-align:center;margin:6px 0 12px"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${C.gold};color:${C.navy};font-family:${SANS};font-size:11px;font-weight:700;letter-spacing:.06em">★ ${tr.kicker}</span></div>
<table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.sand200};border-radius:14px;overflow:hidden">
${src ? `<tr><td><a href="${url}"><img src="${src}" width="896" alt="${escapeHtml(pick(t.title, locale))}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:16px 20px 0;text-align:${align}">${pill(dur)} &nbsp; ${stars(t)}</td></tr>
<tr><td style="padding:10px 20px 0;font-family:${SERIF};font-size:22px;line-height:1.3;font-weight:700;text-align:${align}"><a href="${url}" style="color:${C.navy};text-decoration:none">${escapeHtml(pick(t.title, locale))}</a></td></tr>
<tr><td style="padding:8px 20px 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.ink500};text-align:${align}">${escapeHtml(pick(t.summary, locale))}</td></tr>
${highlights ? `<tr><td style="padding:10px 20px 0"><table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0">${highlights}</table></td></tr>` : ""}
<tr><td style="padding:12px 20px 0;font-family:${SANS};font-size:12px;color:${C.ink500};text-align:${align}">${dur} · ${tr.upTo(t.maxGroup)}${t.freeCancellationHours > 0 ? ` · <span style="color:${C.green};font-weight:600">✓ ${tr.freeCancel}</span>` : ""}</td></tr>
<tr><td style="padding:14px 20px 0;text-align:${align}">${price(t, locale, true)}</td></tr>
<tr><td style="padding:16px 20px 20px">${button(url, tr.seeItinerary, "lg")}</td></tr>
</table>`;
}

function card(t: WelcomeTour, locale: Locale, siteUrl: string): string {
  const tr = T[locale];
  const align = locale === "ar" ? "right" : "left";
  const D = locale === "ar" ? ' dir="rtl"' : "";
  const url = tourUrl(siteUrl, locale, t);
  const src = img(siteUrl, t.coverUrl, 576, 384); // 3:2 like the site's cards, 2× a ~290px column
  const dur = escapeHtml(pick(t.durationLabel, locale));
  return `<div class="oc-card"${D} style="display:inline-block;width:32%;vertical-align:top;margin:0 0.5% 12px;text-align:${align};font-size:13px">
<table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.sand200};border-radius:12px;overflow:hidden">
${src ? `<tr><td><a href="${url}"><img src="${src}" width="290" alt="${escapeHtml(pick(t.title, locale))}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:10px 12px 0;text-align:${align}">${pill(dur)}</td></tr>
<tr><td style="padding:6px 12px 0;font-family:${SANS};font-size:11px;text-align:${align}">${stars(t)}</td></tr>
<tr><td height="60" valign="top" style="padding:6px 12px 0;height:60px;font-family:${SERIF};font-size:15px;line-height:1.35;font-weight:700;text-align:${align}"><a href="${url}" style="color:${C.navy};text-decoration:none">${escapeHtml(pick(t.title, locale))}</a></td></tr>
<tr><td height="40" valign="top" style="padding:6px 12px 0;height:40px;font-family:${SANS};font-size:12px;line-height:1.5;color:${C.ink500};text-align:${align}">${escapeHtml(clip(pick(t.summary, locale), 84))}</td></tr>
<tr><td height="36" valign="top" style="padding:8px 12px 0;height:36px;font-family:${SANS};font-size:11px;line-height:1.5;color:${C.ink500};text-align:${align}">${dur} · ${tr.upTo(t.maxGroup)}${t.freeCancellationHours > 0 ? `<br><span style="color:${C.green};font-weight:600">✓ ${tr.freeCancel}</span>` : ""}</td></tr>
<tr><td style="padding:10px 12px 0;text-align:${align}">${price(t, locale, false)}</td></tr>
<tr><td style="padding:10px 12px 12px">${button(url, tr.view, "sm")}</td></tr>
</table>
</div>`;
}

export function renderWelcomeEmail(opts: {
  locale: Locale;
  siteUrl: string;
  subject: string;
  intro: string; // Markdown from settings or the defaults
  hero: WelcomeTour | null;
  tours: WelcomeTour[];
  unsubscribeUrl: string;
  whatsapp: { display: string; e164: string };
}): string {
  const { locale, siteUrl } = opts;
  const tr = T[locale];
  const align = locale === "ar" ? "right" : "left";
  const D = locale === "ar" ? ' dir="rtl"' : "";
  const cards = opts.tours.map((t) => card(t, locale, siteUrl)).join("");
  const body = `
<div${D}>${markdownToEmailHtml(opts.intro, align)}</div>
${opts.hero ? hero(opts.hero, locale, siteUrl) : ""}
${cards ? `<div${D} style="margin:26px 0 12px;font-family:${SERIF};font-size:18px;color:${C.sand};text-align:${align}">${tr.more}</div>
<div${D} style="font-size:0;text-align:center">${cards}</div>` : ""}
<div style="margin:18px 0 0"><a href="${siteUrl}/${locale}/tours" style="display:block;text-align:center;padding:12px 20px;border:1px solid ${C.gold};border-radius:10px;color:${C.sand};font-family:${SANS};font-weight:600;font-size:14px;text-decoration:none">${tr.browse}</a></div>
<p${D} style="margin:18px 0 0;font-family:${SANS};font-size:14px;line-height:1.6;color:${C.sand};text-align:${align}">${tr.questions} <a href="https://wa.me/${opts.whatsapp.e164.replace(/\D/g, "")}" style="color:#DDB97A" dir="ltr">${opts.whatsapp.display}</a></p>`;
  // On phones the three cards stack at full width, like the site's cards
  const head = `<style>@media only screen and (max-width:520px){.oc-card{width:100%!important;max-width:100%!important;margin:0 0 12px!important}.oc-card td{height:auto!important}}</style>`;
  return layout(locale, opts.subject, body, tr.footer(opts.unsubscribeUrl), head, 960);
}
