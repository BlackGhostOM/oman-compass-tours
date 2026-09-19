import { Resend } from "resend";

export type Locale = "en" | "ar";

const BRAND = {
  navy: "#0E0B2E",
  navy900: "#14113A",
  navy800: "#1E1A4F",
  gold: "#C9A15C",
  sand: "#F6EFE2",
  ink300: "#9C99AE",
};

export const FROM = process.env.EMAIL_FROM ?? "Oman Compass Tours <onboarding@resend.dev>";
export const STAFF_EMAIL = process.env.STAFF_NOTIFICATION_EMAIL ?? "omancompasstours@gmail.com";

/** Wraps HTML body content in the branded email shell (RTL-aware). */
export function layout(locale: Locale, title: string, body: string, footerNote?: string, head = ""): string {
  const dir = locale === "ar" ? "rtl" : "ltr";
  const align = locale === "ar" ? "right" : "left";
  return `<!doctype html><html lang="${locale}" dir="${dir}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${head}</head><body style="margin:0;background:${BRAND.navy};font-family:Inter,Arial,'Segoe UI',Tahoma,sans-serif;color:${BRAND.sand};padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:${BRAND.navy900};border:1px solid ${BRAND.navy800};border-radius:12px;overflow:hidden">
<tr><td style="padding:28px 32px 8px;text-align:center;letter-spacing:.14em;font-size:13px;color:${BRAND.gold};font-family:Cinzel,Georgia,serif">OMAN COMPASS TOURS</td></tr>
<tr><td style="padding:0 32px"><div style="height:1px;background:linear-gradient(90deg,transparent,${BRAND.gold},transparent)"></div></td></tr>
<tr><td style="padding:20px 32px 0;text-align:${align};font-size:20px;font-weight:600;line-height:1.4">${title}</td></tr>
<tr><td style="padding:12px 32px 28px;text-align:${align};font-size:15px;line-height:1.7">${body}</td></tr>
<tr><td style="padding:16px 32px 24px;text-align:${align};font-size:12px;line-height:1.6;color:${BRAND.ink300};border-top:1px solid ${BRAND.navy800}">
${footerNote ?? ""}<br>Oman Compass Tours Company · Bawshar, Muscat, Sultanate of Oman · +968 9225 5028 · omancompasstours@gmail.com<br>Ministry of Heritage &amp; Tourism licence no. 1440944</td></tr>
</table></body></html>`;
}

export function button(href: string, label: string): string {
  return `<p style="margin:20px 0"><a href="${href}" style="display:inline-block;padding:12px 26px;border-radius:12px;background:linear-gradient(135deg,#DDB97A,#C9A15C,#A8843F);color:${BRAND.navy};font-weight:600;text-decoration:none">${label}</a></p>`;
}

export function row(label: string, value: string): string {
  return `<tr><td style="padding:6px 0;color:${BRAND.ink300};font-size:13px;vertical-align:top;width:40%">${label}</td><td style="padding:6px 0;font-size:14px">${value}</td></tr>`;
}

export function table(rows: string): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:12px 0;border-top:1px solid ${BRAND.navy800};border-bottom:1px solid ${BRAND.navy800}">${rows}</table>`;
}

export function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

/**
 * Sends an email through Resend. Returns the provider id, or `skipped` when
 * no API key is configured (local development).
 */
/**
 * Sends up to 100 emails in one Resend batch call (used by newsletter campaigns).
 * Returns `skipped` when no API key is configured.
 */
export async function sendBatch(messages: { to: string; subject: string; html: string; headers?: Record<string, string> }[]): Promise<{ status: "sent" | "skipped" | "failed"; error?: string }> {
  const key = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped] batch of ${messages.length}`);
    return { status: "skipped" };
  }
  if (messages.length === 0) return { status: "sent" };
  const resend = new Resend(key);
  const { error } = await resend.batch.send(messages.map((m) => ({ from: FROM, to: [m.to], subject: m.subject, html: m.html, headers: m.headers })));
  if (error) return { status: "failed", error: JSON.stringify(error) };
  return { status: "sent" };
}

export async function sendEmail(args: {
  to: string | string[];
  subject: string;
  html: string;
  replyTo?: string;
  headers?: Record<string, string>;
  attachments?: { filename: string; content: Buffer | string }[];
}): Promise<{ status: "sent" | "skipped" | "failed"; id?: string; error?: string }> {
  const key = process.env.AUTH_RESEND_KEY ?? process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email skipped] to=${Array.isArray(args.to) ? args.to.join(",") : args.to} subject=${args.subject}`);
    return { status: "skipped" };
  }
  const resend = new Resend(key);
  const { data, error } = await resend.emails.send({
    from: FROM,
    to: Array.isArray(args.to) ? args.to : [args.to],
    subject: args.subject,
    html: args.html,
    replyTo: args.replyTo,
    headers: args.headers,
    attachments: args.attachments,
  });
  if (error) return { status: "failed", error: JSON.stringify(error) };
  return { status: "sent", id: data?.id };
}
