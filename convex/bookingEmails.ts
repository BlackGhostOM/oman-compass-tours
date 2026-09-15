import { v } from "convex/values";
import { internal } from "./_generated/api";
import type { Doc, Id } from "./_generated/dataModel";
import { internalAction, internalMutation, type ActionCtx } from "./_generated/server";
import { button, escapeHtml, layout, row, sendEmail, STAFF_EMAIL, table, type Locale } from "./lib/email";

const SITE_URL = () => process.env.SITE_URL ?? "http://localhost:3000";

type BookingWithTour = Doc<"bookings"> & { tour: Doc<"tours"> | null; items: Doc<"bookingItems">[] };

function omr(baisa: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "ar" ? "ar-OM" : "en-OM", { style: "currency", currency: "OMR", minimumFractionDigits: 3 }).format(baisa / 1000);
}

function dateLabel(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Muscat" }).format(new Date(date + "T00:00:00"));
}

function links(b: Doc<"bookings">, locale: Locale) {
  const base = SITE_URL();
  return {
    confirmation: `${base}/${locale}/booking/${b.reference}?t=${b.voucherToken}`,
    checkout: `${base}/${locale}/checkout/${b.reference}?t=${b.voucherToken}`,
    voucher: `${base}/api/voucher/${b.voucherToken}`,
    ics: `${base}/api/calendar/${b.voucherToken}`,
    whatsapp: `https://wa.me/96892255028?text=${encodeURIComponent(`Booking ${b.reference} — ${b.tourTitle.en} on ${b.date}`)}`,
  };
}

function summaryTable(b: BookingWithTour, locale: Locale): string {
  const t = locale === "ar"
    ? { ref: "رقم الحجز", tour: "الجولة", date: "التاريخ", time: "وقت البدء", guests: "الضيوف", pickup: "الاستلام", total: "الإجمالي", paid: "المدفوع", balance: "المتبقي" }
    : { ref: "Reference", tour: "Tour", date: "Date", time: "Start time", guests: "Guests", pickup: "Pickup", total: "Total", paid: "Paid", balance: "Balance due" };
  const guests = locale === "ar" ? `${b.adults} بالغ · ${b.children} طفل · ${b.infants} رضيع` : `${b.adults} adult(s) · ${b.children} child(ren) · ${b.infants} infant(s)`;
  return table(
    [
      row(t.ref, `<strong>${b.reference}</strong>`),
      row(t.tour, escapeHtml(b.tourTitle[locale])),
      row(t.date, dateLabel(b.date, locale)),
      row(t.time, b.startTime ?? "—"),
      row(t.guests, guests),
      row(t.pickup, escapeHtml(b.traveller.pickupLocation ?? b.traveller.hotel ?? "—")),
      row(t.total, omr(b.total, locale)),
      row(t.paid, omr(b.amountPaid, locale)),
      row(t.balance, omr(Math.max(0, b.total - b.amountPaid), locale)),
    ].join(""),
  );
}

async function loadBooking(ctx: ActionCtx, bookingId: Doc<"bookings">["_id"]): Promise<BookingWithTour | null> {
  return (await ctx.runQuery(internal.bookings.getInternal, { bookingId })) as BookingWithTour | null;
}

async function logEmail(ctx: ActionCtx, template: string, to: string, locale: Locale, bookingId: Doc<"bookings">["_id"], result: { status: "sent" | "skipped" | "failed"; id?: string; error?: string }) {
  await ctx.runMutation(internal.notifications.log, { channel: "email", template, to, locale, bookingId, status: result.status, providerMessageId: result.id, error: result.error });
}

/* ------------------------------------------------------------------ */

export const sendConfirmation = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const l = links(b, locale);
    const title = locale === "ar" ? `تم تأكيد حجزك ${b.reference}` : `Your booking ${b.reference} is confirmed`;
    const intro = locale === "ar"
      ? `مرحبًا ${escapeHtml(b.traveller.firstName)}، يسعدنا تأكيد حجزك. ستجد أدناه التفاصيل، وقسيمة الحجز برمز QR، وملف التقويم.`
      : `Hello ${escapeHtml(b.traveller.firstName)}, we are delighted to confirm your booking. Your details, QR voucher and calendar file are below.`;
    const html = layout(
      locale,
      title,
      `<p>${intro}</p>${summaryTable(b, locale)}
       ${button(l.voucher, locale === "ar" ? "تحميل القسيمة (PDF)" : "Download voucher (PDF)")}
       <p><a href="${l.ics}" style="color:#DDB97A">${locale === "ar" ? "إضافة إلى التقويم (.ics)" : "Add to calendar (.ics)"}</a> · <a href="${l.whatsapp}" style="color:#DDB97A">${locale === "ar" ? "أرسل تأكيدي عبر واتساب" : "Send my confirmation on WhatsApp"}</a> · <a href="${l.confirmation}" style="color:#DDB97A">${locale === "ar" ? "عرض الحجز" : "View booking"}</a></p>
       <p style="color:#9C99AE;font-size:13px">${locale === "ar" ? `إلغاء مجاني حتى ${b.tour?.freeCancellationHours ?? 24} ساعة قبل الموعد.` : `Free cancellation up to ${b.tour?.freeCancellationHours ?? 24} hours before the start time.`}</p>`,
    );
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "booking_confirmation", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

export const sendHoldCreated = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const l = links(b, locale);
    const expires = b.holdExpiresAt ? new Intl.DateTimeFormat(locale === "ar" ? "ar-OM" : "en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Muscat" }).format(new Date(b.holdExpiresAt)) : "";
    const title = locale === "ar" ? `تم حجز مكانك مؤقتًا — ${b.reference}` : `Your place is reserved — ${b.reference}`;
    const body = locale === "ar"
      ? `<p>مرحبًا ${escapeHtml(b.traveller.firstName)}، حجزنا مكانك مؤقتًا. يُرجى إتمام الدفع قبل <strong>${expires}</strong> (بتوقيت عُمان) لتأكيد الحجز.</p>`
      : `<p>Hello ${escapeHtml(b.traveller.firstName)}, we have reserved your place. Please complete payment before <strong>${expires}</strong> (Oman time) to confirm the booking.</p>`;
    const html = layout(locale, title, `${body}${summaryTable(b, locale)}${button(l.checkout, locale === "ar" ? "إتمام الدفع" : "Complete payment")}<p><a href="${l.whatsapp}" style="color:#DDB97A">WhatsApp</a></p>`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "booking_hold", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

export const sendPaymentReceipt = internalAction({
  args: { bookingId: v.id("bookings"), paymentId: v.id("payments") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const l = links(b, locale);
    const title = locale === "ar" ? `تم استلام دفعتك — ${b.reference}` : `Payment received — ${b.reference}`;
    const html = layout(locale, title, `<p>${locale === "ar" ? "شكرًا لك، تم استلام دفعتك." : "Thank you, your payment has been received."}</p>${summaryTable(b, locale)}${button(l.confirmation, locale === "ar" ? "عرض الحجز" : "View booking")}`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "payment_receipt", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

export const sendReminder = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const l = links(b, locale);
    const title = locale === "ar" ? `تذكير: جولتك غدًا — ${b.reference}` : `Reminder: your tour is tomorrow — ${b.reference}`;
    const body = locale === "ar"
      ? `<p>نراك غدًا! سيلتقيك مرشدك في <strong>${b.startTime ?? ""}</strong> عند ${escapeHtml(b.traveller.pickupLocation ?? b.traveller.hotel ?? "نقطة اللقاء المتفق عليها")}. أحضر قسيمتك وماءً وقبعة.</p>`
      : `<p>See you tomorrow! Your guide will meet you at <strong>${b.startTime ?? ""}</strong> at ${escapeHtml(b.traveller.pickupLocation ?? b.traveller.hotel ?? "the agreed meeting point")}. Bring your voucher, water and a hat.</p>`;
    const html = layout(locale, title, `${body}${summaryTable(b, locale)}${button(l.voucher, locale === "ar" ? "القسيمة" : "Voucher")}<p><a href="${l.whatsapp}" style="color:#DDB97A">WhatsApp +968 9225 5028</a></p>`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "booking_reminder", b.traveller.email, locale, bookingId, result);
    await ctx.runMutation(internal.bookings.markReminded, { bookingId });
    return null;
  },
});

export const sendReviewRequest = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const title = locale === "ar" ? `كيف كانت جولتك؟` : `How was your tour?`;
    const reviewUrl = `${SITE_URL()}/${locale}/account/reviews?booking=${b.reference}`;
    const html = layout(locale, title, `<p>${locale === "ar" ? `شكرًا لسفرك معنا يا ${escapeHtml(b.traveller.firstName)}. سيسعدنا سماع رأيك؛ فتقييمك يساعد مسافرين آخرين ويدعم فريقنا الصغير.` : `Thank you for travelling with us, ${escapeHtml(b.traveller.firstName)}. We would love to hear how it went — your review helps other travellers and supports our small team.`}</p>${button(reviewUrl, locale === "ar" ? "اكتب تقييمًا" : "Write a review")}<p><a href="https://www.tripadvisor.com/Attraction_Review-g1940497-d26437481-Reviews-OMAN_COMPASS_TOURS-Muscat_Muscat_Governorate.html" style="color:#DDB97A">Tripadvisor</a></p>`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "review_request", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

export const sendRefundNotice = internalAction({
  args: { bookingId: v.id("bookings"), amountOmr: v.number() },
  returns: v.null(),
  handler: async (ctx, { bookingId, amountOmr }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b || amountOmr <= 0) return null;
    const locale = b.locale;
    const title = locale === "ar" ? `تم إصدار استرداد — ${b.reference}` : `Refund issued — ${b.reference}`;
    const html = layout(locale, title, `<p>${locale === "ar" ? `أصدرنا استردادًا بقيمة <strong>${omr(amountOmr, locale)}</strong> إلى وسيلة الدفع الأصلية. قد يستغرق ظهوره 5–10 أيام عمل.` : `We have issued a refund of <strong>${omr(amountOmr, locale)}</strong> to your original payment method. It can take 5–10 business days to appear.`}</p>${summaryTable(b, locale)}`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "refund_notice", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

export const sendBalanceDue = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const locale = b.locale;
    const l = links(b, locale);
    const title = locale === "ar" ? `المبلغ المتبقي مستحق — ${b.reference}` : `Balance due — ${b.reference}`;
    const html = layout(locale, title, `<p>${locale === "ar" ? "يُسدَّد المبلغ المتبقي لحجزك عند بداية الرحلة إلى مرشدك، نقدًا أو بالبطاقة. ويمكنك أيضًا تسويته عبر الإنترنت الآن:" : "The remaining balance for your booking is payable at the start of your trip to your guide, in cash or by card. You can also settle it online now:"}</p>${summaryTable(b, locale)}${button(l.checkout, locale === "ar" ? "ادفع المتبقي" : "Pay the balance")}`);
    const result = await sendEmail({ to: b.traveller.email, subject: title, html });
    await logEmail(ctx, "balance_due", b.traveller.email, locale, bookingId, result);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Staff notifications                                                 */
/* ------------------------------------------------------------------ */

export const notifyStaffNewBooking = internalAction({
  args: { bookingId: v.id("bookings") },
  returns: v.null(),
  handler: async (ctx, { bookingId }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const html = layout("en", `New ${b.status === "inquiry" ? "reserve-now-pay-later" : "web"} booking ${b.reference}`, `${summaryTable(b, "en")}<p>${escapeHtml(b.traveller.firstName)} ${escapeHtml(b.traveller.lastName)} · ${escapeHtml(b.traveller.email)} · <a href="https://wa.me/${b.traveller.phone.replace(/[^0-9]/g, "")}" style="color:#DDB97A">${escapeHtml(b.traveller.phone)}</a> · ${b.traveller.nationality}</p>${b.traveller.specialRequests ? `<p><em>${escapeHtml(b.traveller.specialRequests)}</em></p>` : ""}${button(`${SITE_URL()}/en/admin/bookings/${b._id}`, "Open in dashboard")}`);
    const result = await sendEmail({ to: STAFF_EMAIL, subject: `[Booking] ${b.reference} · ${b.tourTitle.en} · ${b.date}`, html, replyTo: b.traveller.email });
    await logEmail(ctx, "staff_new_booking", STAFF_EMAIL, "en", bookingId, result);
    return null;
  },
});

export const notifyStaffCancellation = internalAction({
  args: { bookingId: v.id("bookings"), refundEligible: v.boolean() },
  returns: v.null(),
  handler: async (ctx, { bookingId, refundEligible }) => {
    const b = await loadBooking(ctx, bookingId);
    if (!b) return null;
    const html = layout("en", `Customer cancelled ${b.reference}`, `${summaryTable(b, "en")}<p>Refund eligible under policy: <strong>${refundEligible ? "YES — process the refund from Admin → Payments" : "NO (inside the free-cancellation window)"}</strong></p>${button(`${SITE_URL()}/en/admin/bookings/${b._id}`, "Open in dashboard")}`);
    const result = await sendEmail({ to: STAFF_EMAIL, subject: `[Cancelled] ${b.reference} · ${b.tourTitle.en}`, html });
    await logEmail(ctx, "staff_cancellation", STAFF_EMAIL, "en", bookingId, result);
    return null;
  },
});

/* ------------------------------------------------------------------ */
/* Abandoned booking follow-up                                         */
/* ------------------------------------------------------------------ */

export const createAbandonedLead = internalMutation({
  args: { draftId: v.id("bookingDrafts") },
  returns: v.union(v.id("leads"), v.null()),
  handler: async (ctx, { draftId }) => {
    const d = await ctx.db.get(draftId);
    if (!d) return null;
    const data = (d.data ?? {}) as { traveller?: { firstName?: string; lastName?: string; email?: string; phone?: string } };
    const email = data.traveller?.email;
    if (!email) {
      await ctx.db.patch(draftId, { remindedAt: Date.now() });
      return null;
    }
    const tour = await ctx.db.get(d.tourId);
    const leadId = await ctx.db.insert("leads", {
      name: `${data.traveller?.firstName ?? ""} ${data.traveller?.lastName ?? ""}`.trim() || email,
      email,
      phone: data.traveller?.phone,
      message: `Abandoned booking draft for ${tour?.title.en ?? "tour"} (step ${d.step}).`,
      locale: d.locale,
      source: "abandoned_booking",
      tourId: d.tourId,
      bookingDraftId: draftId,
      status: "new",
      slaDueAt: Date.now() + 24 * 3_600_000,
      userId: d.userId,
      updatedAt: Date.now(),
    });
    await ctx.db.patch(draftId, { remindedAt: Date.now() });
    return leadId;
  },
});

export const followUpAbandonedDrafts = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const drafts: Doc<"bookingDrafts">[] = await ctx.runQuery(internal.bookings.abandonedDrafts, {});
    let sent = 0;
    for (const d of drafts) {
      const leadId: Id<"leads"> | null = await ctx.runMutation(internal.bookingEmails.createAbandonedLead, { draftId: d._id });
      const data = (d.data ?? {}) as { traveller?: { firstName?: string; email?: string }; tourSlug?: string };
      if (!leadId || !data.traveller?.email) continue;
      const locale = d.locale;
      const url = `${SITE_URL()}/${locale}/book/${data.tourSlug ?? ""}`;
      const html = layout(locale, locale === "ar" ? "حجزك ما زال بانتظارك" : "Your booking is still waiting", `<p>${locale === "ar" ? `مرحبًا ${escapeHtml(data.traveller.firstName ?? "")}، لاحظنا أنك بدأت حجزًا ولم تكمله. حفظنا اختياراتك؛ يمكنك المتابعة من حيث توقفت.` : `Hello ${escapeHtml(data.traveller.firstName ?? "")}, we noticed you started a booking and did not finish. Your choices are saved — pick up where you left off.`}</p>${button(url, locale === "ar" ? "متابعة الحجز" : "Continue booking")}<p><a href="https://wa.me/96892255028" style="color:#DDB97A">WhatsApp +968 9225 5028</a></p>`);
      const result = await sendEmail({ to: data.traveller.email, subject: locale === "ar" ? "حجزك ما زال بانتظارك — بوصلة عُمان" : "Your Oman Compass booking is still waiting", html });
      await ctx.runMutation(internal.notifications.log, { channel: "email", template: "abandoned_draft", to: data.traveller.email, locale, status: result.status, providerMessageId: result.id, error: result.error });
      sent++;
    }
    return sent;
  },
});

export const sendDueReminders = internalAction({
  args: {},
  returns: v.number(),
  handler: async (ctx): Promise<number> => {
    const ids: Id<"bookings">[] = await ctx.runQuery(internal.bookings.dueForReminder, {});
    for (const bookingId of ids) await ctx.runAction(internal.bookingEmails.sendReminder, { bookingId });
    return ids.length;
  },
});
