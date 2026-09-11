import { v } from "convex/values";
import { ConvexError } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { action } from "./_generated/server";
import { button, escapeHtml, layout, sendEmail } from "./lib/email";

/** Staff: re-send the confirmation email (voucher, ICS, WhatsApp links). */
export const resendConfirmation = action({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    await ctx.runQuery(internal.payments.requireStaffForAction, {});
    await ctx.runAction(internal.bookingEmails.sendConfirmation, { bookingId });
    return null;
  },
});

/** Staff: email a payment link to the customer. */
export const sendPaymentLink = action({
  args: { bookingId: v.id("bookings"), url: v.string(), amountOmr: v.number() },
  returns: v.object({ status: v.string() }),
  handler: async (ctx, { bookingId, url, amountOmr }): Promise<{ status: string }> => {
    await ctx.runQuery(internal.payments.requireStaffForAction, {});
    const b = (await ctx.runQuery(internal.bookings.getInternal, { bookingId })) as (Doc<"bookings"> & { tour: Doc<"tours"> | null }) | null;
    if (!b) throw new ConvexError({ code: "NOT_FOUND" });
    const locale = b.locale;
    const amount = new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", { style: "currency", currency: "OMR", minimumFractionDigits: 3 }).format(amountOmr);
    const title = locale === "ar" ? `رابط الدفع لحجزك ${b.reference}` : `Payment link for booking ${b.reference}`;
    const html = layout(locale, title, `<p>${locale === "ar" ? `مرحبًا ${escapeHtml(b.traveller.firstName)}، يرجى إتمام دفع <strong>${amount}</strong> لحجز ${escapeHtml(b.tourTitle.ar)} بتاريخ ${b.date}.` : `Hello ${escapeHtml(b.traveller.firstName)}, please complete the payment of <strong>${amount}</strong> for ${escapeHtml(b.tourTitle.en)} on ${b.date}.`}</p>${button(url, locale === "ar" ? "ادفع الآن" : "Pay now")}<p style="font-size:12px;color:#9C99AE">${url}</p>`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await ctx.runMutation(internal.notifications.log, { channel: "email", template: "payment_link", to: b.traveller.email, locale, bookingId, status: result.status, providerMessageId: result.id, error: result.error, payload: { url } });
    return { status: result.status };
  },
});

export const sendBalanceDue = action({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    await ctx.runQuery(internal.payments.requireStaffForAction, {});
    await ctx.runAction(internal.bookingEmails.sendBalanceDue, { bookingId });
    return null;
  },
});
