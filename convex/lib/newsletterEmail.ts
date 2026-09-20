import { escapeHtml, layout } from "./email";
import { markdownToEmailHtml } from "./markdown";

/**
 * Newsletter emails: the welcome email (intro, one featured "hero" journey,
 * three recommended tours as cards) and staff-composed campaigns built from
 * ordered blocks (text, image, featured tour, tour cards, button, divider).
 *
 * Table-based HTML with inline styles so it renders in Gmail, Outlook and
 * Apple Mail. Gmail strips dir/lang from <html>/<body>, so every block carries
 * its own dir for Arabic. Photos are cover-cropped by the site's
 * /api/email-image route, since email clients cannot crop with CSS.
 */
export type Locale = "en" | "ar";
export type Localized = { en: string; ar: string };

export type EmailTour = {
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
/** @deprecated alias kept for older imports */
export type WelcomeTour = EmailTour;

export type NewsletterBlock =
  | { type: "text"; body: Localized }
  | { type: "image"; url: string; alt: Localized; link?: string; caption?: Localized }
  | { type: "tour"; code: string }
  | { type: "tours"; codes: string[] }
  | { type: "button"; label: Localized; url: string }
  | { type: "divider" };

export const WELCOME_DEFAULTS = {
  subject: { en: "Welcome to Oman Compass Tours", ar: "أهلًا بك في بوصلة عُمان للسياحة" },
  body: {
    en: "Marhaba, and thank you for joining us.\n\nYou are now on the list for our travel notes: seasonal tips on the best time for each wadi, desert and mountain, new private tours as we launch them, and subscriber-only offers. Expect a note every few weeks, never spam.",
    ar: "مرحبًا بك، وشكرًا لانضمامك إلينا.\n\nأصبحت الآن ضمن قائمة رسائل السفر: نصائح موسمية عن أفضل وقت لكل وادٍ وصحراء وجبل، وجولات خاصة جديدة فور إطلاقها، وعروض للمشتركين فقط. تصلك رسالة كل بضعة أسابيع، ولا رسائل مزعجة.",
  },
};
/** Featured journey and recommended tours in the welcome email; staff override them in Admin → Content → Newsletter. */
export const WELCOME_HERO_CODE = "OCT-010"; // 8-Day Oman Nature & Culture with an Omani Guide – 4WD
export const WELCOME_RECOMMENDED_CODES = ["OCT-008", "OCT-017", "OCT-019"]; // 3-day, 2-day Wahiba camp, 5-day
export const WHATSAPP = { display: "+968 9225 5028", e164: "+96892255028" };
export const siteUrl = () => process.env.SITE_URL ?? "http://localhost:3000";

const USD_RATE = 2.6008; // OMR is pegged to the dollar; the same figure the site's price tag uses
const C = { navy: "#0E0B2E", ink: "#1B1830", ink500: "#6B6880", sand: "#F6EFE2", sand200: "#E6DCC8", gold: "#C9A15C", green: "#1f6f50" };
const GOLD_GRADIENT = "linear-gradient(135deg,#DDB97A,#C9A15C,#A8843F)";
const SERIF = "Cinzel,Georgia,'Times New Roman',serif";
const SANS = "Inter,Arial,'Segoe UI',Tahoma,sans-serif";
// Text scale: the owner found 1× too small and 2× too large in a 960px email (2026-09-20), so 1.5×.
// Three-column cards are ~286px wide and scale less, otherwise their lines would hold only a few words.
export const SCALE = 1.5;
const CARD_SCALE = 1.25;
const EMAIL_WIDTH = 960; // shell; content is 896px inside the 32px padding
const fs = (n: number, s = SCALE) => `${Math.round(n * s)}px`;

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
const dirAttr = (locale: Locale) => (locale === "ar" ? ' dir="rtl"' : "");
const alignOf = (locale: Locale) => (locale === "ar" ? "right" : "left");
function clip(s: string, max: number): string {
  if (s.length <= max) return s;
  const cut = s.lastIndexOf(" ", max);
  return s.slice(0, cut > max / 2 ? cut : max).replace(/[،,;:\s]+$/, "") + "…";
}
const safeUrl = (u: string) => (/^https?:\/\//i.test(u) || u.startsWith("/") ? escapeHtml(u) : "#");

/** Photo through the site's /api/email-image route: cover-cropped to w×h, or resized to w when h is omitted. Other hosts are used as-is. */
function emailImage(site: string, url: string | undefined, w: number, h?: number): string | undefined {
  if (!url) return undefined;
  const proxied = url.startsWith("/") || /^https:\/\/[^/]+\.convex\.(cloud|site)\//.test(url);
  if (!proxied) return escapeHtml(url);
  return `${site}/api/email-image?src=${encodeURIComponent(url)}&w=${w}${h ? `&h=${h}` : ""}`;
}
const tourUrl = (site: string, locale: Locale, t: EmailTour) => `${site}/${locale}/tours/${encodeURIComponent(pick(t.slug, locale))}`;

function stars(t: EmailTour): string {
  const count = t.ratingCount + (t.externalReviewCount ?? 0);
  const n = Math.max(1, Math.min(5, Math.round(t.ratingAverage || 5)));
  return `<span style="color:${C.gold};letter-spacing:1px">${"★".repeat(n)}</span> <span style="font-weight:700;color:${C.ink}">${(t.ratingAverage || 5).toFixed(1)}</span>${count ? ` <span style="color:${C.ink500}">(${count})</span>` : ""}`;
}

function price(t: EmailTour, locale: Locale, big: boolean, s = SCALE): string {
  const tr = T[locale];
  return `<div style="font-family:${SANS};font-size:${fs(11, s)};color:${C.ink500}">${tr.from}</div>
<div dir="ltr" style="display:inline-block;font-family:${SERIF};font-size:${fs(big ? 24 : 17, s)};line-height:1.2;font-weight:700;color:${C.navy}">OMR ${omr(t.priceFrom)}</div>
<div style="font-family:${SANS};font-size:${fs(11, s)};color:${C.ink500}">${t.pricingModel === "per_group" ? tr.perGroup : tr.perAdult} · <span dir="ltr">≈ $${usd(t.priceFrom)}</span></div>`;
}

export function button(href: string, label: string, size: "sm" | "lg", s = SCALE): string {
  const pad = size === "lg" ? `${fs(13, s)} ${fs(20, s)}` : `${fs(9, s)} ${fs(10, s)}`;
  return `<a href="${safeUrl(href)}" style="display:block;text-align:center;padding:${pad};border-radius:10px;background:${C.gold};background-image:${GOLD_GRADIENT};color:${C.navy};font-family:${SANS};font-weight:700;font-size:${fs(size === "lg" ? 15 : 12, s)};text-decoration:none">${escapeHtml(label)}</a>`;
}

const pill = (text: string, s = SCALE) => `<span style="display:inline-block;padding:${fs(3, s)} ${fs(10, s)};border-radius:999px;background:${C.navy};color:${C.sand};font-family:${SANS};font-size:${fs(11, s)};font-weight:600">${text}</span>`;

/** Full-width card for one journey: banner photo, duration, rating, title, summary, four highlights, meta, price, button. */
export function hero(t: EmailTour, locale: Locale, site: string, kicker?: string): string {
  const tr = T[locale];
  const align = alignOf(locale);
  const D = dirAttr(locale);
  const url = tourUrl(site, locale, t);
  const src = emailImage(site, t.coverUrl, 1344, 806); // 5:3 banner, ~1.5× the 896px content width
  const dur = escapeHtml(pick(t.durationLabel, locale));
  const highlights = t.highlights
    .slice(0, 4)
    .map((h) => `<tr><td style="padding:3px 0;font-family:${SANS};font-size:${fs(13)};line-height:1.5;color:${C.ink};text-align:${align}"><span style="color:${C.gold}">◆</span>&nbsp; ${escapeHtml(pick(h, locale))}</td></tr>`)
    .join("");
  return `
${kicker ? `<div style="text-align:center;margin:6px 0 12px"><span style="display:inline-block;padding:5px 14px;border-radius:999px;background:${C.gold};color:${C.navy};font-family:${SANS};font-size:${fs(11)};font-weight:700;letter-spacing:.06em">★ ${escapeHtml(kicker)}</span></div>` : ""}
<table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.sand200};border-radius:14px;overflow:hidden;margin:0 0 16px">
${src ? `<tr><td><a href="${url}"><img src="${src}" width="896" alt="${escapeHtml(pick(t.title, locale))}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:16px 20px 0;text-align:${align}">${pill(dur)} &nbsp; ${stars(t)}</td></tr>
<tr><td style="padding:10px 20px 0;font-family:${SERIF};font-size:${fs(22)};line-height:1.3;font-weight:700;text-align:${align}"><a href="${url}" style="color:${C.navy};text-decoration:none">${escapeHtml(pick(t.title, locale))}</a></td></tr>
<tr><td style="padding:8px 20px 0;font-family:${SANS};font-size:${fs(14)};line-height:1.6;color:${C.ink500};text-align:${align}">${escapeHtml(pick(t.summary, locale))}</td></tr>
${highlights ? `<tr><td style="padding:10px 20px 0"><table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0">${highlights}</table></td></tr>` : ""}
<tr><td style="padding:12px 20px 0;font-family:${SANS};font-size:${fs(12)};color:${C.ink500};text-align:${align}">${dur} · ${tr.upTo(t.maxGroup)}${t.freeCancellationHours > 0 ? ` · <span style="color:${C.green};font-weight:600">✓ ${tr.freeCancel}</span>` : ""}</td></tr>
<tr><td style="padding:14px 20px 0;text-align:${align}">${price(t, locale, true)}</td></tr>
<tr><td style="padding:16px 20px 20px">${button(url, tr.seeItinerary, "lg")}</td></tr>
</table>`;
}

/** One tour card, sized for a row of `columns` cards (1–3). Fixed section heights keep a row's cards level. */
function card(t: EmailTour, locale: Locale, site: string, columns: number): string {
  const tr = T[locale];
  const align = alignOf(locale);
  const D = dirAttr(locale);
  const s = columns === 1 ? SCALE : CARD_SCALE;
  const width = columns === 1 ? "100%" : columns === 2 ? "49%" : "32%";
  const imgW = columns === 1 ? 1344 : columns === 2 ? 880 : 576;
  const url = tourUrl(site, locale, t);
  const src = emailImage(site, t.coverUrl, imgW, Math.round((imgW * 2) / 3)); // 3:2 like the site's cards
  const dur = escapeHtml(pick(t.durationLabel, locale));
  const heights = columns === 3 ? { title: 104, summary: 72, meta: 64 } : { title: 0, summary: 0, meta: 0 };
  const hAttr = (h: number) => (h ? ` height="${h}" valign="top"` : "");
  const hStyle = (h: number) => (h ? `height:${h}px;` : "");
  return `<div class="oc-card"${D} style="display:inline-block;width:${width};vertical-align:top;margin:0 0.5% 12px;text-align:${align};font-size:${fs(13, s)}">
<table role="presentation"${D} width="100%" cellpadding="0" cellspacing="0" style="background:#ffffff;border:1px solid ${C.sand200};border-radius:12px;overflow:hidden">
${src ? `<tr><td><a href="${url}"><img src="${src}" width="${columns === 1 ? 896 : columns === 2 ? 439 : 290}" alt="${escapeHtml(pick(t.title, locale))}" style="display:block;width:100%;height:auto;border:0"></a></td></tr>` : ""}
<tr><td style="padding:10px 12px 0;text-align:${align}">${pill(dur, s)}</td></tr>
<tr><td style="padding:6px 12px 0;font-family:${SANS};font-size:${fs(11, s)};text-align:${align}">${stars(t)}</td></tr>
<tr><td${hAttr(heights.title)} style="padding:6px 12px 0;${hStyle(heights.title)}font-family:${SERIF};font-size:${fs(15, s)};line-height:1.35;font-weight:700;text-align:${align}"><a href="${url}" style="color:${C.navy};text-decoration:none">${escapeHtml(pick(t.title, locale))}</a></td></tr>
<tr><td${hAttr(heights.summary)} style="padding:6px 12px 0;${hStyle(heights.summary)}font-family:${SANS};font-size:${fs(12, s)};line-height:1.5;color:${C.ink500};text-align:${align}">${escapeHtml(columns === 3 ? clip(pick(t.summary, locale), 84) : pick(t.summary, locale))}</td></tr>
<tr><td${hAttr(heights.meta)} style="padding:8px 12px 0;${hStyle(heights.meta)}font-family:${SANS};font-size:${fs(11, s)};line-height:1.5;color:${C.ink500};text-align:${align}">${dur} · ${tr.upTo(t.maxGroup)}${t.freeCancellationHours > 0 ? `<br><span style="color:${C.green};font-weight:600">✓ ${tr.freeCancel}</span>` : ""}</td></tr>
<tr><td style="padding:10px 12px 0;text-align:${align}">${price(t, locale, false, s)}</td></tr>
<tr><td style="padding:10px 12px 12px">${button(url, tr.view, "sm", s)}</td></tr>
</table>
</div>`;
}

/** A row of one to three tour cards; on phones they stack at full width (see the media query in the shell head). */
export function cardsRow(tours: EmailTour[], locale: Locale, site: string): string {
  const shown = tours.slice(0, 3);
  if (shown.length === 0) return "";
  return `<div${dirAttr(locale)} style="font-size:0;text-align:center;margin:0 0 8px">${shown.map((t) => card(t, locale, site, shown.length)).join("")}</div>`;
}

const HEAD = `<style>@media only screen and (max-width:520px){.oc-card{width:100%!important;max-width:100%!important;margin:0 0 12px!important}.oc-card td{height:auto!important}}</style>`;

function closing(locale: Locale, site: string, withBrowse: boolean): string {
  const tr = T[locale];
  const align = alignOf(locale);
  return `${withBrowse ? `<div style="margin:18px 0 0"><a href="${site}/${locale}/tours" style="display:block;text-align:center;padding:${fs(12)} ${fs(20)};border:1px solid ${C.gold};border-radius:10px;color:${C.sand};font-family:${SANS};font-weight:600;font-size:${fs(14)};text-decoration:none">${tr.browse}</a></div>` : ""}
<p${dirAttr(locale)} style="margin:18px 0 0;font-family:${SANS};font-size:${fs(14)};line-height:1.6;color:${C.sand};text-align:${align}">${tr.questions} <a href="https://wa.me/${WHATSAPP.e164.replace(/\D/g, "")}" style="color:#DDB97A" dir="ltr">${WHATSAPP.display}</a></p>`;
}

export function renderWelcomeEmail(opts: {
  locale: Locale;
  siteUrl: string;
  subject: string;
  intro: string; // Markdown from settings or the defaults
  hero: EmailTour | null;
  tours: EmailTour[];
  unsubscribeUrl: string;
}): string {
  const { locale, siteUrl: site } = opts;
  const tr = T[locale];
  const align = alignOf(locale);
  const D = dirAttr(locale);
  const cards = cardsRow(opts.tours, locale, site);
  const body = `
<div${D}>${markdownToEmailHtml(opts.intro, align, SCALE)}</div>
${opts.hero ? hero(opts.hero, locale, site, tr.kicker) : ""}
${cards ? `<div${D} style="margin:18px 0 12px;font-family:${SERIF};font-size:${fs(18)};color:${C.sand};text-align:${align}">${tr.more}</div>${cards}` : ""}
${closing(locale, site, true)}`;
  return layout(locale, opts.subject, body, tr.footer(opts.unsubscribeUrl), HEAD, EMAIL_WIDTH, SCALE);
}

/** Tour codes referenced by a campaign's blocks (for loading them before rendering). */
export function codesInBlocks(blocks: NewsletterBlock[]): string[] {
  const codes: string[] = [];
  for (const b of blocks) {
    if (b.type === "tour") codes.push(b.code);
    if (b.type === "tours") codes.push(...b.codes);
  }
  return [...new Set(codes.filter(Boolean))];
}

function renderBlock(b: NewsletterBlock, locale: Locale, site: string, tours: Record<string, EmailTour>): string {
  const align = alignOf(locale);
  const D = dirAttr(locale);
  switch (b.type) {
    case "text":
      return `<div${D}>${markdownToEmailHtml(pick(b.body, locale), align, SCALE)}</div>`;
    case "image": {
      const src = emailImage(site, b.url, 1344);
      if (!src) return "";
      const img = `<img src="${src}" width="896" alt="${escapeHtml(pick(b.alt, locale))}" style="display:block;width:100%;height:auto;border:0;border-radius:12px">`;
      const caption = b.caption && pick(b.caption, locale) ? `<p${D} style="margin:8px 0 0;font-family:${SANS};font-size:${fs(12)};color:${C.sand};opacity:.8;text-align:${align}">${escapeHtml(pick(b.caption, locale))}</p>` : "";
      return `<div style="margin:16px 0">${b.link ? `<a href="${safeUrl(b.link)}">${img}</a>` : img}${caption}</div>`;
    }
    case "tour": {
      const t = tours[b.code];
      return t ? hero(t, locale, site) : "";
    }
    case "tours":
      return cardsRow(b.codes.map((c) => tours[c]).filter((t): t is EmailTour => !!t), locale, site);
    case "button":
      return `<div style="margin:16px 0">${button(b.url, pick(b.label, locale), "lg")}</div>`;
    case "divider":
      return `<div style="height:1px;margin:22px 0;background:linear-gradient(90deg,transparent,${C.gold},transparent)"></div>`;
  }
}

/** A staff-composed campaign: the blocks in order, then the WhatsApp line and the unsubscribe footer. */
export function renderCampaignEmail(opts: {
  locale: Locale;
  siteUrl: string;
  subject: string;
  blocks: NewsletterBlock[];
  tours: Record<string, EmailTour>;
  unsubscribeUrl: string;
}): string {
  const { locale, siteUrl: site } = opts;
  const body = `${opts.blocks.map((b) => renderBlock(b, locale, site, opts.tours)).join("\n")}\n${closing(locale, site, false)}`;
  return layout(locale, opts.subject, body, T[locale].footer(opts.unsubscribeUrl), HEAD, EMAIL_WIDTH, SCALE);
}
