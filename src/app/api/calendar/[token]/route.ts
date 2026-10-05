import { NextResponse } from "next/server";
import { fetchQuery } from "convex/nextjs";
import { createEvent } from "ics";
import { api } from "../../../../../convex/_generated/api";
import { site } from "@/lib/site";
import { departureMs, lastTourDay, normalizeStartTime } from "../../../../../convex/lib/dates";
import { guestsLine } from "../../../../../convex/lib/guests";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const booking = await fetchQuery(api.bookings.byToken, { token }).catch(() => null);
  if (!booking) return NextResponse.json({ error: "not_found" }, { status: 404 });

  // Oman is UTC+4 all year, so the departure is written as an exact UTC instant (DTSTART ...Z) and every calendar app
  // shows it at the right local time. A blank or malformed stored time falls back to the tour's first departure.
  const startTime = [booking.startTime, booking.tour?.startTimes?.[0]].map((t) => (t ? normalizeStartTime(t) : null)).find(Boolean) ?? "08:00";
  const startMs = departureMs(booking.date, startTime);
  if (!Number.isFinite(startMs)) return NextResponse.json({ error: "ics_failed" }, { status: 500 });
  const durationMinutes = booking.tour?.durationMinutes ?? 240;
  const days = booking.tour?.durationDays ?? 1;
  // Multi-day tours end at 18:00 Oman time on their last day; lastTourDay rolls months and years over.
  const endMs = days > 1 ? departureMs(lastTourDay(booking.date, days), "18:00") : NaN;

  const confirmed = ["confirmed", "in_progress", "completed"].includes(booking.status);
  const unpaid = booking.status === "inquiry" || booking.status === "pending_payment";
  const status = confirmed ? "CONFIRMED" : unpaid ? "TENTATIVE" : "CANCELLED";
  const where = booking.traveller.pickupLocation || booking.traveller.hotel || booking.tour?.meetingPoint?.label.en;

  const { error, value } = createEvent({
    title: `${unpaid ? "Reserved, unpaid: " : ""}${booking.tourTitle.en} — Oman Compass Tours (${booking.reference})`,
    description: [
      `Booking ${booking.reference}`,
      booking.tourTitle.ar,
      `Start: ${startTime} Oman time (GMT+4)`,
      `Guests: ${guestsLine(booking, "en")}`,
      `Pickup: ${where || "As agreed"}`,
      unpaid ? `Not confirmed until paid: ${site.url}/en/checkout/${booking.reference}?t=${booking.voucherToken}` : null,
      confirmed ? `Voucher: ${site.url}/api/voucher/${booking.voucherToken}` : null,
      `WhatsApp: ${site.phoneDisplay}`,
    ].filter(Boolean).join("\n"),
    location: where || "Muscat, Oman",
    start: startMs,
    startInputType: "utc",
    startOutputType: "utc",
    ...(Number.isFinite(endMs) && endMs > startMs
      ? { end: endMs, endInputType: "utc" as const, endOutputType: "utc" as const }
      : { duration: { minutes: Math.min(durationMinutes, 1439) } }),
    status,
    organizer: { name: site.name, email: site.email },
    url: `${site.url}/en/booking/${booking.reference}?t=${booking.voucherToken}`,
    uid: `${booking.reference}@omancompasstours.com`,
    productId: "omancompasstours/booking",
    // Only a confirmed tour gets a reminder; an unpaid hold may lapse and a cancelled one is not happening
    ...(confirmed ? { alarms: [{ action: "display" as const, description: "Tour tomorrow — Oman Compass Tours", trigger: { hours: 24, before: true } }] } : {}),
  });
  if (error || !value) return NextResponse.json({ error: "ics_failed" }, { status: 500 });

  return new NextResponse(value, {
    status: 200,
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": `attachment; filename="oman-compass-${booking.reference}.ics"`,
      "Cache-Control": "private, no-store",
    },
  });
}
